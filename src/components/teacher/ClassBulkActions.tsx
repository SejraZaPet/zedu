import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ClipboardList, MessageSquare, Download, X, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export interface BulkMember {
  user_id: string;
  first_name: string;
  last_name: string;
  student_code: string | null;
}

interface Props {
  classId: string;
  className: string;
  selected: BulkMember[];
  onClear: () => void;
}

export function ClassBulkActions({ classId, className, selected, onClear }: Props) {
  const [openAssign, setOpenAssign] = useState(false);
  const [openMessage, setOpenMessage] = useState(false);
  const [busy, setBusy] = useState(false);

  // Assignment form
  const [aTitle, setATitle] = useState("");
  const [aDesc, setADesc] = useState("");
  const [aDeadline, setADeadline] = useState("");
  const [aLessonPlanId, setALessonPlanId] = useState("");

  // Message form
  const [mTitle, setMTitle] = useState("");
  const [mContent, setMContent] = useState("");

  const count = selected.length;
  const ids = selected.map((s) => s.user_id);

  const submitAssign = async () => {
    if (!aTitle.trim()) {
      toast.error("Doplňte název úkolu.");
      return;
    }
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const teacherId = u?.user?.id;
      if (!teacherId) throw new Error("Nejste přihlášeni.");

      const { error } = await supabase.from("assignments").insert({
        teacher_id: teacherId,
        class_id: classId,
        title: aTitle.trim(),
        description: aDesc.trim(),
        deadline: aDeadline ? new Date(aDeadline).toISOString() : null,
        lesson_plan_id: aLessonPlanId.trim() || null,
        status: "published",
        settings: { target_student_ids: ids },
      });
      if (error) throw error;
      toast.success(`Úkol zadán pro ${count} žáků.`);
      setOpenAssign(false);
      setATitle("");
      setADesc("");
      setADeadline("");
      setALessonPlanId("");
      onClear();
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se zadat úkol.");
    } finally {
      setBusy(false);
    }
  };

  const submitMessage = async () => {
    if (!mTitle.trim() || !mContent.trim()) {
      toast.error("Doplňte název i obsah zprávy.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.rpc("send_notification", {
        _title: mTitle.trim(),
        _content: mContent.trim(),
        _receiver_type: "user",
        _receiver_ids: ids,
        _type: "message",
      });
      if (error) throw error;
      toast.success(`Zpráva odeslána ${count} žákům.`);
      setOpenMessage(false);
      setMTitle("");
      setMContent("");
      onClear();
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se odeslat zprávu.");
    } finally {
      setBusy(false);
    }
  };

  const exportExcel = async () => {
    setBusy(true);
    try {
      // Fetch latest attempts for these students in this class
      const { data: classAssigns } = await supabase
        .from("assignments")
        .select("id, title")
        .eq("class_id", classId);

      const assignIds = (classAssigns ?? []).map((a) => a.id);
      let attempts: any[] = [];
      if (assignIds.length > 0) {
        const { data } = await supabase
          .from("assignment_attempts")
          .select("student_id, assignment_id, score, max_score, status, submitted_at")
          .in("student_id", ids)
          .in("assignment_id", assignIds);
        attempts = data ?? [];
      }

      const titleById: Record<string, string> = {};
      (classAssigns ?? []).forEach((a) => { titleById[a.id] = a.title; });

      const summary = selected.map((s) => {
        const own = attempts.filter((a) => a.student_id === s.user_id);
        const submitted = own.filter((a) => a.status === "submitted");
        const scored = submitted.filter((a) => typeof a.score === "number" && typeof a.max_score === "number" && a.max_score > 0);
        const avgPct = scored.length
          ? Math.round(
              (scored.reduce((sum, a) => sum + (a.score / a.max_score) * 100, 0) / scored.length) * 10
            ) / 10
          : null;
        return {
          Jméno: s.first_name,
          Příjmení: s.last_name,
          "Kód žáka": s.student_code ?? "",
          "Odevzdané úkoly": submitted.length,
          "Průměr (%)": avgPct ?? "—",
        };
      });

      const detail = attempts.map((a) => {
        const stu = selected.find((s) => s.user_id === a.student_id);
        const max = a.max_score ?? 0;
        return {
          Žák: stu ? `${stu.first_name} ${stu.last_name}` : "",
          Úkol: titleById[a.assignment_id] ?? a.assignment_id,
          Stav: a.status,
          Body: a.score ?? "",
          Maximum: max,
          "Úspěšnost (%)":
            typeof a.score === "number" && max > 0
              ? Math.round((a.score / max) * 1000) / 10
              : "",
          Odevzdáno: a.submitted_at
            ? new Date(a.submitted_at).toLocaleString("cs-CZ")
            : "",
        };
      });

      const wb = XLSX.utils.book_new();
      const ws1 = XLSX.utils.json_to_sheet(summary);
      XLSX.utils.book_append_sheet(wb, ws1, "Žáci");
      if (detail.length > 0) {
        const ws2 = XLSX.utils.json_to_sheet(detail);
        XLSX.utils.book_append_sheet(wb, ws2, "Pokusy");
      }

      const safeName = className.replace(/[^a-zA-Z0-9-_]+/g, "_") || "trida";
      const stamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${safeName}_vysledky_${stamp}.xlsx`);
      toast.success("Export stažen.");
    } catch (e: any) {
      toast.error(e.message || "Nepodařilo se vytvořit export.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-medium">
            Vybráno: <span className="text-primary">{count}</span>{" "}
            {count === 1 ? "žák" : count < 5 ? "žáci" : "žáků"}
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => setOpenAssign(true)} disabled={busy}>
            <ClipboardList className="w-4 h-4 mr-1.5" /> Zadat úkol
          </Button>
          <Button size="sm" variant="outline" onClick={() => setOpenMessage(true)} disabled={busy}>
            <MessageSquare className="w-4 h-4 mr-1.5" /> Poslat zprávu
          </Button>
          <Button size="sm" variant="outline" onClick={exportExcel} disabled={busy}>
            {busy ? (
              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Download className="w-4 h-4 mr-1.5" />
            )}
            Exportovat
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear} disabled={busy}>
            <X className="w-4 h-4 mr-1.5" /> Zrušit výběr
          </Button>
        </div>
      </div>

      {/* Assign dialog */}
      <Dialog open={openAssign} onOpenChange={setOpenAssign}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Zadat úkol vybraným žákům</DialogTitle>
            <DialogDescription>
              Úkol bude publikován ve třídě „{className}". Cíloví žáci ({count}) jsou
              uloženi v nastavení úkolu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-a-title">Název</Label>
              <Input
                id="bulk-a-title"
                value={aTitle}
                onChange={(e) => setATitle(e.target.value)}
                placeholder="Např. Domácí úkol z matematiky"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-a-desc">Popis</Label>
              <Textarea
                id="bulk-a-desc"
                value={aDesc}
                onChange={(e) => setADesc(e.target.value)}
                rows={3}
                disabled={busy}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-a-deadline">Termín</Label>
                <Input
                  id="bulk-a-deadline"
                  type="datetime-local"
                  value={aDeadline}
                  onChange={(e) => setADeadline(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bulk-a-lesson">ID lekce (volitelné)</Label>
                <Input
                  id="bulk-a-lesson"
                  value={aLessonPlanId}
                  onChange={(e) => setALessonPlanId(e.target.value)}
                  placeholder="UUID lesson_plan"
                  disabled={busy}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenAssign(false)} disabled={busy}>
              Zrušit
            </Button>
            <Button onClick={submitAssign} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Zadat úkol
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Message dialog */}
      <Dialog open={openMessage} onOpenChange={setOpenMessage}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hromadná zpráva</DialogTitle>
            <DialogDescription>
              Zpráva bude doručena {count} vybraným žákům jako notifikace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-m-title">Předmět</Label>
              <Input
                id="bulk-m-title"
                value={mTitle}
                onChange={(e) => setMTitle(e.target.value)}
                placeholder="Krátký předmět zprávy"
                disabled={busy}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-m-content">Text</Label>
              <Textarea
                id="bulk-m-content"
                value={mContent}
                onChange={(e) => setMContent(e.target.value)}
                rows={5}
                disabled={busy}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenMessage(false)} disabled={busy}>
              Zrušit
            </Button>
            <Button onClick={submitMessage} disabled={busy}>
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Odeslat zprávu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

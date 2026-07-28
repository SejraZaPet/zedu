import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, XCircle, FileBadge2, Download, User } from "lucide-react";

type Status = "pending" | "approved" | "rejected";

interface Row {
  id: string;
  enrollment_id: string;
  description: string;
  file_url: string | null;
  submitted_at: string;
  status: Status;
  reviewer_id: string | null;
  reviewer_comment: string | null;
  reviewed_at: string | null;
  teacher_id: string;
  teacher_name: string | null;
  teacher_email: string | null;
  course_id: string;
  course_title: string;
}

const statusBadge = (s: Status) => {
  if (s === "approved") return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">Schváleno</Badge>;
  if (s === "rejected") return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">Zamítnuto</Badge>;
  return <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30">Čeká</Badge>;
};

const AcademyEvidenceReviewManager = () => {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Status>("pending");

  const [dlgRow, setDlgRow] = useState<Row | null>(null);
  const [dlgAction, setDlgAction] = useState<"approve" | "reject">("approve");
  const [dlgComment, setDlgComment] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("academy_evidence_submissions")
      .select(`
        id, enrollment_id, description, file_url, submitted_at, status,
        reviewer_id, reviewer_comment, reviewed_at,
        academy_enrollments!inner (
          teacher_id, course_id,
          profiles:teacher_id ( full_name, email ),
          academy_courses ( title )
        )
      `)
      .order("submitted_at", { ascending: false });
    if (error) {
      toast.error("Chyba načítání", { description: error.message });
      setLoading(false);
      return;
    }
    const mapped: Row[] = (data || []).map((r: any) => ({
      id: r.id,
      enrollment_id: r.enrollment_id,
      description: r.description,
      file_url: r.file_url,
      submitted_at: r.submitted_at,
      status: r.status,
      reviewer_id: r.reviewer_id,
      reviewer_comment: r.reviewer_comment,
      reviewed_at: r.reviewed_at,
      teacher_id: r.academy_enrollments?.teacher_id,
      teacher_name: r.academy_enrollments?.profiles?.full_name ?? null,
      teacher_email: r.academy_enrollments?.profiles?.email ?? null,
      course_id: r.academy_enrollments?.course_id,
      course_title: r.academy_enrollments?.academy_courses?.title ?? "",
    }));
    setRows(mapped);
    setLoading(false);
  }, []);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  const openReview = (row: Row, action: "approve" | "reject") => {
    setDlgRow(row);
    setDlgAction(action);
    setDlgComment(row.reviewer_comment || "");
  };

  const submitReview = async () => {
    if (!dlgRow || !user) return;
    if (dlgAction === "reject" && !dlgComment.trim()) {
      toast.error("U zamítnutí prosím napište krátký komentář pro učitele.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("academy_evidence_submissions")
      .update({
        status: dlgAction === "approve" ? "approved" : "rejected",
        reviewer_id: user.id,
        reviewer_comment: dlgComment.trim() || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", dlgRow.id);
    setSaving(false);
    if (error) return toast.error("Chyba", { description: error.message });
    toast.success(dlgAction === "approve" ? "Schváleno – certifikát bude vydán." : "Zamítnuto.");
    setDlgRow(null);
    fetchRows();
  };

  const downloadAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("academy-evidence").createSignedUrl(path, 300);
    if (error || !data?.signedUrl) return toast.error("Nepodařilo se vytvořit odkaz", { description: error?.message });
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const filtered = rows.filter((r) => r.status === tab);
  const counts = {
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    rejected: rows.filter((r) => r.status === "rejected").length,
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading text-xl font-semibold">Posouzení důkazů z praxe</h2>
          <p className="text-sm text-muted-foreground">Kurzy s vyžadovaným důkazem: schvalte nebo zamítněte odevzdaná potvrzení. Certifikát se vydá až po schválení.</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)}>
        <TabsList>
          <TabsTrigger value="pending">Čekající {counts.pending > 0 && <Badge variant="secondary" className="ml-2">{counts.pending}</Badge>}</TabsTrigger>
          <TabsTrigger value="approved">Schválené <Badge variant="secondary" className="ml-2">{counts.approved}</Badge></TabsTrigger>
          <TabsTrigger value="rejected">Zamítnuté <Badge variant="secondary" className="ml-2">{counts.rejected}</Badge></TabsTrigger>
        </TabsList>

        {(["pending", "approved", "rejected"] as Status[]).map((s) => (
          <TabsContent key={s} value={s} className="mt-4">
            {loading ? (
              <p className="text-muted-foreground">Načítání…</p>
            ) : filtered.length === 0 ? (
              <p className="text-muted-foreground">Nic k zobrazení.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((r) => (
                  <Card key={r.id} className="p-4 space-y-3">
                    <div className="flex items-start gap-3 flex-wrap">
                      <FileBadge2 className="w-5 h-5 text-primary mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{r.course_title}</span>
                          {statusBadge(r.status)}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <User className="w-3 h-3" />
                          {r.teacher_name || r.teacher_email || r.teacher_id}
                          <span aria-hidden>·</span>
                          <span>Odesláno {new Date(r.submitted_at).toLocaleString("cs-CZ")}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-muted/50 text-sm whitespace-pre-wrap">{r.description}</div>

                    {r.file_url && (
                      <Button size="sm" variant="outline" onClick={() => downloadAttachment(r.file_url!)}>
                        <Download className="w-4 h-4 mr-1" /> Stáhnout přílohu
                      </Button>
                    )}

                    {r.reviewer_comment && r.status !== "pending" && (
                      <div className="text-sm p-3 rounded-lg border border-border">
                        <div className="font-medium mb-1">Komentář recenzenta</div>
                        <div className="whitespace-pre-wrap text-muted-foreground">{r.reviewer_comment}</div>
                      </div>
                    )}

                    {r.status === "pending" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        <Button size="sm" onClick={() => openReview(r, "approve")}>
                          <CheckCircle2 className="w-4 h-4 mr-1" /> Schválit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openReview(r, "reject")}>
                          <XCircle className="w-4 h-4 mr-1" /> Zamítnout
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={!!dlgRow} onOpenChange={(o) => { if (!o) setDlgRow(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dlgAction === "approve" ? "Schválit důkaz z praxe" : "Zamítnout důkaz z praxe"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {dlgAction === "approve"
                ? "Po schválení bude učiteli automaticky vydán certifikát tohoto kurzu."
                : "Napište prosím konstruktivní komentář, aby učitel věděl, co doplnit. Bude moci důkaz znovu odeslat."}
            </p>
            <Textarea
              rows={4}
              placeholder={dlgAction === "approve" ? "Volitelný komentář…" : "Např. Prosíme doplňte konkrétní příklad z hodiny…"}
              value={dlgComment}
              onChange={(e) => setDlgComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgRow(null)}>Zrušit</Button>
            <Button onClick={submitReview} disabled={saving}>
              {saving ? "Ukládám…" : dlgAction === "approve" ? "Schválit" : "Zamítnout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AcademyEvidenceReviewManager;

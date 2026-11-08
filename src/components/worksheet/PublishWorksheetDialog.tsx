import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { hasWorksheet, sameWorksheetTarget, worksheetLinkPatch, type LinkAssignment } from "@/lib/worksheet-assignment-link";
import { assignmentKind } from "@/lib/assignment-kind";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Send, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useTeacherClasses } from "@/hooks/useTeacherClasses";
import { useSubjectGroups } from "@/hooks/useSubjectGroups";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  worksheetId: string;
  worksheetTitle: string;
  subjectId?: string | null;
  /** Lekce, ke které je list napojený; jen pak se nabízí „Zobrazit žákům u lekce“. */
  sourceLessonId?: string | null;
  /** Called after successful publish (and optional assignment creation). */
  onPublished?: (info: { assignmentCreated: boolean; showInLesson?: boolean; worksheetPublished?: boolean }) => void;
}

/**
 * Publikování pracovního listu rovnou se zadáním konkrétní třídě nebo skupině,
 * aby žáci list uviděli — samotné publikování je pro ně neviditelné.
 */
export default function PublishWorksheetDialog({
  open, onOpenChange, worksheetId, worksheetTitle, subjectId, sourceLessonId, onPublished,
}: Props) {
  const { myClasses: teacherClasses } = useTeacherClasses();
  const { groups } = useSubjectGroups();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [existing, setExisting] = useState<LinkAssignment[]>([]);
  const [existingId, setExistingId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [duplicates, setDuplicates] = useState<LinkAssignment[]>([]);
  const [pendingNew, setPendingNew] = useState(false);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);

  const [assign, setAssign] = useState(true);
  const [target, setTarget] = useState<string>("");
  const [deadline, setDeadline] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [showInLesson, setShowInLesson] = useState(true);

  const myClasses = useMemo(() => teacherClasses ?? [], [teacherClasses]);
  const selectedSubject = target.startsWith("group:") ? groups.find(g => g.id === target.slice(6))?.subject_id ?? subjectId ?? null : subjectId ?? null;
  const eligible = existing.filter(a => sameWorksheetTarget(a, ownerId, target, selectedSubject));
  useEffect(() => {
    setExistingId(""); setDuplicates([]); setPendingNew(false); setReplaceConfirmed(false);
    if (!open || !target) { setExisting([]); return; }
    let cancelled = false;
    setLoadingExisting(true); setLoadError("");
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Přihlaste se znovu.");
      const [kind, id] = target.split(":");
      const { data, error } = await supabase.from("assignments").select("id,title,teacher_id,subject_id,class_id,group_id,worksheet_id,settings")
        .eq("teacher_id", user.id).eq(kind === "group" ? "group_id" : "class_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      if (!cancelled) { setOwnerId(user.id); setExisting((data ?? []) as LinkAssignment[]); }
    })().catch(() => { if (!cancelled) setLoadError("Úlohy se nepodařilo načíst. Zkuste znovu vybrat třídu nebo skupinu."); })
      .finally(() => { if (!cancelled) setLoadingExisting(false); });
    return () => { cancelled = true; };
  }, [open, target, worksheetId]);
  useEffect(() => { setPendingNew(false); setDuplicates([]); setReplaceConfirmed(false); }, [mode, existingId, selectedSubject]);

  const submit = async (allowDuplicate = false) => {
    if (assign && !target) {
      toast({ title: "Vyber třídu nebo skupinu", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) throw new Error("Nejsi přihlášená");

      if (assign && target) {
        const [kind, targetId] = target.split(":");
        const { data: fresh, error: readError } = await supabase.from("assignments").select("id,title,teacher_id,subject_id,class_id,group_id,worksheet_id,settings,updated_at")
          .eq("teacher_id", userId).eq(kind === "group" ? "group_id" : "class_id", targetId);
        if (readError) throw readError;
        const rows = (fresh ?? []) as (LinkAssignment & { updated_at: string })[];
        if (mode === "existing") {
          const assignment = rows.find(a => a.id === existingId && sameWorksheetTarget(a, userId, target, selectedSubject));
          if (!assignment) throw new Error("Vyberte vlastní úkol nebo materiál pro stejný předmět a třídu/skupinu.");
          if (assignment.worksheet_id && assignment.worksheet_id !== worksheetId && assignmentKind(assignment.settings) === "task" && !replaceConfirmed) {
            setReplaceConfirmed(true);
            return;
          }
          const patch = worksheetLinkPatch(assignment, { id: worksheetId, title: worksheetTitle });
          const { data: changed, error } = await supabase.from("assignments").update(patch as any).eq("id", assignment.id).eq("teacher_id", userId)
            .eq("updated_at", assignment.updated_at).select("id").maybeSingle();
          if (error) throw error;
          if (!changed) throw new Error("Úloha se mezitím změnila. Vyberte ji znovu a zopakujte přidání.");
          toast({ title: "List přidán do existující úlohy", description: "Ostatní nastavení a stav úlohy zůstaly beze změny." });
          onOpenChange(false); onPublished?.({ assignmentCreated: false, worksheetPublished: false });
          return;
        }
        const matches = rows.filter(a => assignmentKind(a.settings) !== "announcement" && hasWorksheet(a, worksheetId));
        if (matches.length && !allowDuplicate) { setDuplicates(matches); setPendingNew(true); return; }
      }

      const { error: pubErr } = await supabase
        .from("worksheets" as any)
        .update({
          status: "published",
          scheduled_publish_at: null,
          ...(sourceLessonId ? { show_in_lesson: showInLesson } : {}),
        } as any)
        .eq("id", worksheetId).eq("teacher_id", userId);
      if (pubErr) throw pubErr;

      let assignmentCreated = false;
      if (assign && target) {
        const [kind, targetId] = target.split(":");
        const group = kind === "group" ? groups.find((g) => g.id === targetId) : null;
        const { error: aErr } = await supabase.from("assignments").insert({
          teacher_id: userId,
          title: worksheetTitle || "Pracovní list",
          worksheet_id: worksheetId,
          class_id: kind === "class" ? targetId : null,
          group_id: kind === "group" ? targetId : null,
          subject_id: group?.subject_id ?? subjectId ?? null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          status: "published",
        } as any);
        if (aErr) throw aErr;
        assignmentCreated = true;
      }

      toast({
        title: "Publikováno",
        description: assignmentCreated
          ? "Pracovní list je zadán a žáci ho vidí."
          : sourceLessonId && showInLesson
            ? "List uvidí žáci s přístupem k lekci."
            : "Pozor: list není nikomu zadán, žáci ho neuvidí.",
      });
      onOpenChange(false);
      onPublished?.({ assignmentCreated, worksheetPublished: true, showInLesson: sourceLessonId ? showInLesson : undefined });
    } catch (e: any) {
      toast({ title: "Publikování selhalo", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto overflow-x-hidden [&_button]:min-h-11 [&_input]:min-h-11 [&_[role=checkbox]]:min-h-11 [&_[role=checkbox]]:min-w-11">
        <DialogHeader>
          <DialogTitle>Zadat žákům</DialogTitle>
          <DialogDescription>
            Žáci uvidí pracovní list jen tehdy, když ho zadáte konkrétní třídě nebo skupině.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {sourceLessonId && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={showInLesson}
                onCheckedChange={(v) => setShowInLesson(v === true)}
                className="mt-0.5"
                aria-label="Zobrazit žákům u lekce"
              />
              <span className="text-sm">Zobrazit žákům u lekce</span>
            </label>
          )}
          <label className="flex items-start gap-2 cursor-pointer">
            <Checkbox
              checked={assign}
              onCheckedChange={(v) => setAssign(v === true)}
              className="mt-0.5"
            />
            <span className="text-sm">Zadat rovnou třídě nebo skupině</span>
          </label>

          {assign ? (
            <>
              <div className="flex flex-col gap-2" aria-label="Způsob zadání">
                <Button variant={mode === "new" ? "default" : "outline"} aria-pressed={mode === "new"} disabled={busy} onClick={() => setMode("new")}>Vytvořit nový úkol</Button>
                <Button variant={mode === "existing" ? "default" : "outline"} aria-pressed={mode === "existing"} disabled={busy} onClick={() => setMode("existing")}>Přidat do existujícího úkolu</Button>
              </div>
              <div>
                <Label>Komu zadat *</Label>
                <Select value={target} onValueChange={setTarget} disabled={busy}>
                  <SelectTrigger>
                    <SelectValue placeholder="Vyberte třídu nebo skupinu" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover">
                    {myClasses.map((c) => (
                      <SelectItem key={c.id} value={`class:${c.id}`}>
                        Třída {c.name}
                      </SelectItem>
                    ))}
                    {groups.filter(g => !subjectId || g.subject_id === subjectId).map((g) => (
                      <SelectItem key={g.id} value={`group:${g.id}`}>
                        Skupina {g.name}
                        {g.subjectName ? ` · ${g.subjectName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {myClasses.length === 0 && groups.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Nemáte zatím žádnou třídu ani skupinu.
                  </p>
                )}
              </div>
              {mode === "existing" ? <div className="space-y-3 min-w-0">
                <SearchableSelect label="Vybrat existující úkol nebo materiál" value={existingId} disabled={busy || loadingExisting || !target} options={eligible.map(a => ({ value: a.id, label: a.title, subtitle: assignmentKind(a.settings) === "material" ? "Materiál" : "Úkol" }))} onValueChange={setExistingId} />
                {target && !loadingExisting && !eligible.length && !loadError && <p className="text-sm text-muted-foreground">Pro tento předmět a třídu/skupinu nemáte žádný úkol ani materiál.</p>}
                {replaceConfirmed && <p role="alert" className="text-sm text-destructive">Úkol již má jiný list. Přidáním nahradíte původní list; dosavadní odevzdání zůstanou beze změny. Opravdu pokračovat?</p>}
              </div> : <div>
                <Label htmlFor="ws-deadline">Termín odevzdání</Label>
                <Input
                  id="ws-deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">Nepovinné.</p>
              </div>}
              {loadError && <p role="alert" className="text-sm text-destructive">{loadError}</p>}
              {pendingNew && <div role="alert" className="border-2 border-destructive rounded-lg p-3 space-y-2 min-w-0">
                <p className="text-sm font-semibold text-destructive">Pro tuto skupinu nebo třídu už existuje úkol s tímto listem.</p>
                {duplicates.map(a => <Button key={a.id} variant="outline" className="w-full h-auto whitespace-normal break-words" onClick={() => { onOpenChange(false); navigate(`/ucitel/ulohy?detail=${a.id}`); }}>Otevřít: {a.title}</Button>)}
                <Button variant="outline" className="w-full" disabled={busy} onClick={() => void submit(true)}>Přesto vytvořit nový</Button>
              </div>}
            </>
          ) : (
            <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>Bez zadání pracovní list žáci ve svém přehledu neuvidí.</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Zrušit</Button>
          <Button onClick={() => void submit()} disabled={busy || (assign && (loadingExisting || !!loadError || (mode === "existing" && !existingId) || pendingNew))}>
            <Send className="w-4 h-4 mr-2" />
            {busy ? "Ukládám…" : assign && mode === "existing" ? replaceConfirmed ? "Potvrdit nahrazení listu" : "Přidat list" : "Publikovat"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

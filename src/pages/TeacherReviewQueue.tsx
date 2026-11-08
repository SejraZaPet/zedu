import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SearchField } from "@/components/ui/search-field";
import WorksheetAttemptGrading, { type TeacherGrading } from "@/components/admin/WorksheetAttemptGrading";
import { submittableOnly } from "@/lib/assignment-kind";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Loader2,
  MessageSquarePlus,
  Undo2,
} from "lucide-react";
import {
  buildReviewRows,
  filterReviewRows,
  moveReviewIndex,
  prepareBulkComment,
  prepareMarkReviewed,
  prepareUndo,
  loadCommentTemplates,
  saveCommentTemplate,
  type ReviewAssignment,
  type ReviewAttempt,
  type ReviewRow,
  type ReviewStateFilter,
  type BulkPatch,
} from "@/lib/grading-review";

const ALL = "__all__";

interface PendingAction {
  kind: "reviewed" | "comment" | "undo";
  rows: ReviewRow[];
  comment?: string;
}

export default function TeacherReviewQueue() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [assignments, setAssignments] = useState<ReviewAssignment[]>([]);
  const [targetNames, setTargetNames] = useState<Record<string, string>>({});
  const [assignmentFilter, setAssignmentFilter] = useState(ALL);
  const [targetFilter, setTargetFilter] = useState(ALL);
  const [stateFilter, setStateFilter] = useState<ReviewStateFilter>("pending");
  const [openOnly, setOpenOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [notifyStudents, setNotifyStudents] = useState(false);
  const [comment, setComment] = useState("");
  const [templates, setTemplates] = useState<string[]>(() => loadCommentTemplates(localStorage));
  const [lastUndoable, setLastUndoable] = useState<ReviewRow[]>([]);
  const detailRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: asg, error: asgErr } = await supabase
        .from("assignments" as any)
        .select("id, title, class_id, group_id, worksheet_id, status, settings")
        .eq("created_by", user.id)
        .neq("status", "archived");
      if (asgErr) throw asgErr;
      // Jen úkoly – materiály a oznámení se nekontrolují.
      const tasks = submittableOnly((asg ?? []) as any[]) as ReviewAssignment[];
      setAssignments(tasks);
      const asgIds = tasks.map((a) => a.id);
      if (asgIds.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      const classIds = [...new Set(tasks.map((a) => a.class_id).filter(Boolean))] as string[];
      const groupIds = [...new Set(tasks.map((a) => a.group_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      const memberIds = new Set<string>();
      if (classIds.length > 0) {
        const [{ data: cls }, { data: cm }] = await Promise.all([
          supabase.from("classes").select("id, name").in("id", classIds),
          supabase.from("class_members").select("class_id, user_id").in("class_id", classIds),
        ]);
        for (const c of (cls ?? []) as any[]) names[c.id] = c.name;
        for (const m of (cm ?? []) as any[]) memberIds.add(m.user_id);
      }
      if (groupIds.length > 0) {
        const [{ data: gr }, { data: gm }] = await Promise.all([
          supabase.from("subject_groups").select("id, name").in("id", groupIds),
          supabase.from("subject_group_members").select("group_id, student_id").in("group_id", groupIds),
        ]);
        for (const g of (gr ?? []) as any[]) names[g.id] = g.name;
        for (const m of (gm ?? []) as any[]) memberIds.add(m.student_id);
      }
      setTargetNames(names);

      const { data: at, error: atErr } = await supabase
        .from("assignment_attempts")
        .select("id, assignment_id, student_id, status, score, max_score, submitted_at, attempt_number, group_id, answers, progress, teacher_feedback_text, teacher_feedback_emoji")
        .in("assignment_id", asgIds)
        .eq("status", "submitted");
      if (atErr) throw atErr;
      const attempts = (at ?? []) as unknown as ReviewAttempt[];

      const studentIds = [...new Set(attempts.map((a) => a.student_id))];
      const profiles: Record<string, { first_name: string; last_name: string }> = {};
      if (studentIds.length > 0) {
        const { data: pf } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", studentIds);
        for (const p of (pf ?? []) as any[]) {
          profiles[p.id] = { first_name: p.first_name || "", last_name: p.last_name || "" };
        }
      }

      // Specy listů pro detekci otevřených odpovědí.
      const wsIds = [...new Set(tasks.map((a) => a.worksheet_id).filter(Boolean))] as string[];
      const specs: Record<string, unknown> = {};
      if (wsIds.length > 0) {
        const { data: ws } = await supabase.from("worksheets").select("id, spec").in("id", wsIds);
        for (const w of (ws ?? []) as any[]) specs[w.id] = w.spec;
      }

      setRows(buildReviewRows({ assignments: tasks, attempts, profiles, targetNames: names, worksheetSpecs: specs }));
    } catch (e: any) {
      toast({ title: "Chyba načítání", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(
    () =>
      filterReviewRows(rows, {
        assignmentId: assignmentFilter === ALL ? null : assignmentFilter,
        targetId: targetFilter === ALL ? null : targetFilter,
        state: stateFilter,
        openOnly,
        query,
      }),
    [rows, assignmentFilter, targetFilter, stateFilter, openOnly, query],
  );

  const activeIndex = filtered.findIndex((r) => r.attemptId === activeId);
  const activeRow = activeIndex >= 0 ? filtered[activeIndex] : null;

  const goTo = useCallback(
    (idx: number) => {
      const row = filtered[idx];
      if (!row) return;
      setActiveId(row.attemptId);
      detailRef.current?.scrollIntoView({ block: "nearest" });
    },
    [filtered],
  );

  // Klávesy: J/šipka dolů = další, K/šipka nahoru = předchozí (mimo textová pole).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "j" || e.key === "J" || e.key === "ArrowDown") {
        e.preventDefault();
        goTo(moveReviewIndex(activeIndex, 1, filtered.length));
      } else if (e.key === "k" || e.key === "K" || e.key === "ArrowUp") {
        e.preventDefault();
        goTo(moveReviewIndex(activeIndex, -1, filtered.length));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIndex, filtered.length, goTo]);

  const patchAttempt = async (attemptId: string, patch: Record<string, unknown>) => {
    const { error } = await supabase
      .from("assignment_attempts" as any)
      .update(patch as any)
      .eq("id", attemptId);
    if (error) throw error;
  };

  /** Uložení bodování po položkách – stejný mechanismus jako v detailu úkolu. */
  const saveGrading = async (row: ReviewRow, g: Omit<TeacherGrading, "graded_at" | "graded_by">) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const { data: cur, error: readErr } = await supabase
        .from("assignment_attempts" as any)
        .select("progress")
        .eq("id", row.attemptId)
        .maybeSingle();
      if (readErr) throw readErr;
      const prevProgress =
        (cur as any)?.progress && typeof (cur as any).progress === "object"
          ? (cur as any).progress
          : {};
      const grading: TeacherGrading = { ...g, graded_at: now, graded_by: user?.id ?? null };
      await patchAttempt(row.attemptId, {
        score: g.total,
        max_score: g.max,
        progress: { ...prevProgress, _teacher_grading: grading },
        teacher_feedback_at: now,
        teacher_feedback_by: user?.id ?? null,
      });
      // Upozornění žákovi jako v detailu úkolu (jednotlivé, ne hromadné).
      if (user) {
        await supabase.from("notifications").insert({
          recipient_id: row.studentId,
          sender_id: user.id,
          sender_role: "teacher",
          type: "assignment_feedback",
          title: "Nová zpětná vazba k úkolu",
          body: `Učitel ohodnotil tvůj úkol „${row.assignmentTitle}“: ${g.total} / ${g.max} bodů.`,
          link: `/n/${row.assignmentId}`,
          status: "sent",
          sent_at: now,
          payload: { assignment_id: row.assignmentId, attempt_id: row.attemptId },
        } as any);
      }
      toast({ title: "Hodnocení uloženo", description: `${g.total} / ${g.max} bodů` });
      await load();
      // Po uložení nabídni další nezkontrolovaný pokus.
      const next = moveReviewIndex(activeIndex, 1, filtered.length);
      if (next >= 0 && next !== activeIndex) goTo(next);
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const runBulk = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const now = new Date().toISOString();
      const by = user?.id ?? null;
      for (const row of pending.rows) {
        // Čteme progress těsně před zápisem, abychom nic nepřepsali.
        const { data: cur, error: readErr } = await supabase
          .from("assignment_attempts" as any)
          .select("progress, teacher_feedback_text, teacher_feedback_emoji")
          .eq("id", row.attemptId)
          .maybeSingle();
        if (readErr) throw readErr;
        const fresh: ReviewAttempt = { ...row.attempt, ...(cur as any) };
        let patch: BulkPatch | null = null;
        if (pending.kind === "reviewed") patch = prepareMarkReviewed(fresh, now, by);
        else if (pending.kind === "comment") patch = prepareBulkComment(fresh, pending.comment ?? "", now, by);
        else patch = prepareUndo(fresh, now, by);
        if (!patch) continue;
        await patchAttempt(row.attemptId, patch as unknown as Record<string, unknown>);
        // Upozornění žákům jen při výslovném zaškrtnutí (výchozí vypnuté).
        if (notifyStudents && user && pending.kind === "comment") {
          const text = pending.comment ?? "";
          await supabase.from("notifications").insert({
            recipient_id: row.studentId,
            sender_id: user.id,
            sender_role: "teacher",
            type: "assignment_feedback",
            title: "Nová zpětná vazba k úkolu",
            body: text.length > 140 ? text.slice(0, 140) + "…" : text,
            link: `/n/${row.assignmentId}`,
            status: "sent",
            sent_at: now,
            payload: { assignment_id: row.assignmentId, attempt_id: row.attemptId },
          } as any);
        }
      }
      if (pending.kind !== "undo") setLastUndoable(pending.rows);
      else setLastUndoable([]);
      toast({
        title: pending.kind === "undo" ? "Akce vrácena" : "Hotovo",
        description: `${pending.rows.length} ${pending.rows.length === 1 ? "žák" : pending.rows.length < 5 ? "žáci" : "žáků"}`,
      });
      setPending(null);
      setSelected(new Set());
      setNotifyStudents(false);
      await load();
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.attemptId)),
    [filtered, selected],
  );

  const toggleAll = () => {
    if (selectedRows.length === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((r) => r.attemptId)));
  };

  const pendingCount = rows.filter((r) => !r.reviewed).length;

  return (
    <div className="container mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-brand-sm flex items-center justify-center shrink-0">
          <ClipboardCheck className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-semibold">Ke kontrole</h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount === 0
              ? "Vše je zkontrolované."
              : `${pendingCount} ${pendingCount === 1 ? "odevzdání čeká" : pendingCount < 5 ? "odevzdání čekají" : "odevzdání čeká"} na kontrolu.`}
          </p>
        </div>
      </div>

      {/* Filtry */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={assignmentFilter} onValueChange={setAssignmentFilter}>
          <SelectTrigger className="w-full sm:w-56 min-h-11" aria-label="Filtr úkolu">
            <SelectValue placeholder="Všechny úkoly" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Všechny úkoly</SelectItem>
            {assignments.map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={targetFilter} onValueChange={setTargetFilter}>
          <SelectTrigger className="w-full sm:w-48 min-h-11" aria-label="Filtr třídy nebo skupiny">
            <SelectValue placeholder="Všechny třídy" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Všechny třídy a skupiny</SelectItem>
            {Object.entries(targetNames).map(([id, name]) => (
              <SelectItem key={id} value={id}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stateFilter} onValueChange={(v) => setStateFilter(v as ReviewStateFilter)}>
          <SelectTrigger className="w-full sm:w-44 min-h-11" aria-label="Filtr stavu">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Ke kontrole</SelectItem>
            <SelectItem value="reviewed">Zkontrolované</SelectItem>
            <SelectItem value="all">Všechny</SelectItem>
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 min-h-11 px-2 text-sm cursor-pointer">
          <Checkbox checked={openOnly} onCheckedChange={(v) => setOpenOnly(v === true)} />
          Jen s otevřenými odpověďmi
        </label>
        <div className="w-full sm:w-64">
          <SearchField value={query} onChange={setQuery} label="Hledat žáka nebo úkol" />
        </div>
      </div>

      {/* Hromadné akce */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
          <span className="text-sm font-medium">
            Vybráno: {selectedRows.length}
          </span>
          <Button
            type="button"
            size="sm"
            className="min-h-11"
            onClick={() => setPending({ kind: "reviewed", rows: selectedRows })}
          >
            <CheckCheck className="w-4 h-4 mr-1" /> Označit jako zkontrolované
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => setPending({ kind: "comment", rows: selectedRows, comment })}
          >
            <MessageSquarePlus className="w-4 h-4 mr-1" /> Stejný komentář
          </Button>
          {lastUndoable.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11"
              onClick={() => setPending({ kind: "undo", rows: lastUndoable })}
            >
              <Undo2 className="w-4 h-4 mr-1" /> Vrátit zpět poslední akci ({lastUndoable.length})
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Seznam */}
        <div className="rounded-lg border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Checkbox
              checked={filtered.length > 0 && selectedRows.length === filtered.length}
              onCheckedChange={toggleAll}
              aria-label="Vybrat všechny zobrazené"
            />
            <span className="text-xs text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "odevzdání" : filtered.length < 5 ? "odevzdání" : "odevzdání"}
            </span>
          </div>
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              Nic tu není. Zkuste změnit filtry.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((r) => (
                <li key={r.attemptId}>
                  <div
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 cursor-pointer min-h-11",
                      activeId === r.attemptId && "bg-accent/50",
                    )}
                    onClick={() => setActiveId(r.attemptId)}
                  >
                    <Checkbox
                      checked={selected.has(r.attemptId)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v === true) next.add(r.attemptId);
                        else next.delete(r.attemptId);
                        setSelected(next);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Vybrat ${r.studentName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{r.studentName}</span>
                        {r.reviewed ? (
                          <Badge variant="secondary" className="shrink-0">Zkontrolováno</Badge>
                        ) : (
                          <Badge className="shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">Čeká</Badge>
                        )}
                        {r.groupSubmission && <Badge variant="outline" className="shrink-0">Skupina</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {r.assignmentTitle} · {r.targetName}
                        {r.submittedAt && ` · ${format(new Date(r.submittedAt), "d. M. HH:mm", { locale: cs })}`}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {r.score != null ? `${r.score}/${r.maxScore ?? "?"}` : "—"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div ref={detailRef} className="rounded-lg border border-border bg-card p-4 space-y-4">
          {!activeRow ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Vyberte odevzdání vlevo. Klávesy J/K nebo šipky posouvají na další/předchozí.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-heading text-lg font-semibold truncate">{activeRow.studentName}</h2>
                  <p className="text-sm text-muted-foreground truncate">
                    {activeRow.assignmentTitle} · {activeRow.targetName}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={activeIndex <= 0}
                    onClick={() => goTo(moveReviewIndex(activeIndex, -1, filtered.length))}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Předchozí
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {activeIndex + 1} / {filtered.length}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    disabled={activeIndex < 0 || activeIndex >= filtered.length - 1}
                    onClick={() => goTo(moveReviewIndex(activeIndex, 1, filtered.length))}
                  >
                    Další <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>

              {activeRow.worksheetId ? (
                <WorksheetAttemptGrading
                  worksheetId={activeRow.worksheetId}
                  answers={(activeRow.attempt.answers as Record<string, unknown>) ?? null}
                  existing={(readGradingSafe(activeRow.attempt.progress) as TeacherGrading | null)}
                  saving={saving}
                  onSave={(g) => saveGrading(activeRow, g)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Tento úkol nemá pracovní list – bodování po položkách není k dispozici.
                </p>
              )}

              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {!activeRow.reviewed && (
                  <Button
                    type="button"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setPending({ kind: "reviewed", rows: [activeRow] })}
                  >
                    <CheckCheck className="w-4 h-4 mr-1" /> Označit jako zkontrolované
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Potvrzení hromadné akce */}
      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.kind === "reviewed" && "Označit jako zkontrolované"}
              {pending?.kind === "comment" && "Přidat stejný komentář"}
              {pending?.kind === "undo" && "Vrátit zpět poslední akci"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Akce se týká {pending?.rows.length}{" "}
              {(pending?.rows.length ?? 0) === 1 ? "žáka" : (pending?.rows.length ?? 0) < 5 ? "žáků" : "žáků"}.
              Body ani stav odevzdání se nemění.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pending?.kind === "comment" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {templates.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setComment(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Komentář pro vybrané žáky…"
                rows={3}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="min-h-11"
                disabled={!comment.trim()}
                onClick={() => setTemplates(saveCommentTemplate(localStorage, comment))}
              >
                Uložit jako šablonu
              </Button>
            </div>
          )}
          {pending?.kind !== "undo" && (
            <label className="flex items-center gap-2 min-h-11 text-sm cursor-pointer">
              <Checkbox
                checked={notifyStudents}
                onCheckedChange={(v) => setNotifyStudents(v === true)}
              />
              Upozornit žáky (výchozí vypnuté)
            </label>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">Zrušit</AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              disabled={saving || (pending?.kind === "comment" && !comment.trim())}
              onClick={(e) => {
                e.preventDefault();
                runBulk();
              }}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Potvrdit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function readGradingSafe(progress: unknown): TeacherGrading | null {
  if (!progress || typeof progress !== "object") return null;
  const g = (progress as Record<string, unknown>)._teacher_grading;
  if (!g || typeof g !== "object") return null;
  return g as TeacherGrading;
}

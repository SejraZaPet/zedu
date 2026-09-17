import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  Minus,
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
  MessageSquare,
  Save,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { cn } from "@/lib/utils";
import AssignmentMaterialsList from "@/components/assignments/AssignmentMaterialsList";
import { parseMaterials, type AssignmentMaterial } from "@/lib/assignment-materials";
import { getStudentAttachmentSignedUrl } from "@/lib/portfolio";
import { resolveLinkedLesson, type LinkedLessonInfo } from "@/lib/linked-lesson";
import { BookOpen } from "lucide-react";

type StudentStatus = "not_started" | "in_progress" | "submitted";

const STATUS_CONFIG: Record<StudentStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  not_started: { label: "Nezahájeno", icon: Minus, className: "bg-muted text-muted-foreground" },
  in_progress: { label: "Rozpracováno", icon: AlertCircle, className: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  submitted: { label: "Dokončeno", icon: CheckCircle2, className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
};

/** Rychlé reakce učitele – jedna z nich se ukládá do teacher_feedback_emoji. */
const FEEDBACK_EMOJIS = ["👍", "🎉", "💡", "❗", "✅"];

export interface AssignmentDetailAssignment {
  id: string;
  title: string;
  description?: string | null;
  deadline?: string | null;
  materials?: unknown;
  class_id?: string | null;
  group_id?: string | null;
  lesson_id?: string | null;
  lesson_source?: string | null;
}

interface AttemptInfo {
  id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  last_saved_at: string | null;
  answers: Record<string, unknown> | null;
  submission_note: string | null;
  teacher_feedback_text: string | null;
  teacher_feedback_emoji: string | null;
  teacher_feedback_at: string | null;
}

interface StudentRow {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  status: StudentStatus;
  attemptCount: number;
  bestScore: number | null;
  maxScore: number | null;
  lastActivity: string | null;
  latestAttempt: AttemptInfo | null;
  attachments: Array<{ id: string; file_name: string; file_path: string }>;
}

interface Props {
  assignment: AssignmentDetailAssignment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Needitovatelný přehled zadání + stav odevzdání jednotlivých žáků
 * s panelem zpětné vazby učitele (emoji + slovní hodnocení).
 */
const AssignmentDetailDialog = ({ assignment, open, onOpenChange }: Props) => {
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [attachUrls, setAttachUrls] = useState<Record<string, string>>({});
  const [materials, setMaterials] = useState<AssignmentMaterial[]>([]);
  /** Lekce z učebnice propojená se zadáním (nepovinná). */
  const [linkedLesson, setLinkedLesson] = useState<LinkedLessonInfo | null>(null);

  useEffect(() => {
    if (!assignment?.lesson_id) {
      setLinkedLesson(null);
      return;
    }
    let cancelled = false;
    resolveLinkedLesson(assignment.lesson_id, assignment.lesson_source ?? null)
      .then((info) => {
        if (!cancelled) setLinkedLesson(info);
      })
      .catch(() => {
        if (!cancelled) setLinkedLesson(null);
      });
    return () => {
      cancelled = true;
    };
  }, [assignment?.lesson_id, assignment?.lesson_source]);

  const load = useCallback(async () => {
    if (!assignment) return;
    setLoading(true);
    try {
      setMaterials(parseMaterials(assignment.materials));

      // Členové cílové třídy nebo skupiny předmětu
      let studentIds: string[] = [];
      if (assignment.group_id) {
        const { data } = await supabase
          .from("subject_group_members")
          .select("student_id")
          .eq("group_id", assignment.group_id);
        studentIds = (data || []).map((m: any) => m.student_id).filter(Boolean);
      } else if (assignment.class_id) {
        const { data } = await supabase
          .from("class_members")
          .select("user_id")
          .eq("class_id", assignment.class_id);
        studentIds = (data || []).map((m: any) => m.user_id).filter(Boolean);
      }

      const [attemptsRes, filesRes] = await Promise.all([
        supabase
          .from("assignment_attempts" as any)
          .select("*")
          .eq("assignment_id", assignment.id),
        supabase
          .from("assignment_attachments" as any)
          .select("id, student_id, file_name, file_path")
          .eq("assignment_id", assignment.id),
      ]);

      const attemptsByStudent: Record<string, any[]> = {};
      ((attemptsRes.data as any[]) || []).forEach((att: any) => {
        if (!attemptsByStudent[att.student_id]) attemptsByStudent[att.student_id] = [];
        attemptsByStudent[att.student_id].push(att);
        if (!studentIds.includes(att.student_id)) studentIds.push(att.student_id);
      });

      const filesByStudent: Record<string, any[]> = {};
      ((filesRes.data as any[]) || []).forEach((f: any) => {
        if (!filesByStudent[f.student_id]) filesByStudent[f.student_id] = [];
        filesByStudent[f.student_id].push(f);
      });

      if (studentIds.length === 0) {
        setStudents([]);
        return;
      }

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email")
        .in("id", studentIds);
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p; });

      const rows: StudentRow[] = studentIds.map((sid) => {
        const profile = profileMap[sid] || {};
        const atts = (attemptsByStudent[sid] || []).slice().sort(
          (a: any, b: any) => (b.attempt_number ?? 0) - (a.attempt_number ?? 0),
        );
        const submitted = atts.filter((a: any) => a.status === "submitted");
        const inProg = atts.find((a: any) => a.status === "in_progress");

        let status: StudentStatus = "not_started";
        if (submitted.length > 0) status = "submitted";
        else if (inProg) status = "in_progress";

        const scores = submitted.filter((a: any) => a.score !== null).map((a: any) => a.score as number);
        const dates = atts.map((a: any) => a.submitted_at || a.last_saved_at).filter(Boolean) as string[];
        const latest = atts[0];

        return {
          studentId: sid,
          firstName: profile.first_name || "",
          lastName: profile.last_name || "",
          email: profile.email || "",
          status,
          attemptCount: atts.length,
          bestScore: scores.length > 0 ? Math.max(...scores) : null,
          maxScore: submitted.find((a: any) => a.max_score !== null)?.max_score ?? null,
          lastActivity: dates.length > 0 ? dates.sort().reverse()[0] : null,
          latestAttempt: latest
            ? {
                id: latest.id,
                status: latest.status,
                score: latest.score ?? null,
                max_score: latest.max_score ?? null,
                submitted_at: latest.submitted_at ?? null,
                last_saved_at: latest.last_saved_at ?? null,
                answers: latest.answers ?? null,
                submission_note: latest.submission_note ?? null,
                teacher_feedback_text: latest.teacher_feedback_text ?? null,
                teacher_feedback_emoji: latest.teacher_feedback_emoji ?? null,
                teacher_feedback_at: latest.teacher_feedback_at ?? null,
              }
            : null,
          attachments: filesByStudent[sid] || [],
        };
      });

      rows.sort((a, b) => a.lastName.localeCompare(b.lastName, "cs"));
      setStudents(rows);
      setDrafts(
        Object.fromEntries(
          rows.filter((r) => r.latestAttempt).map((r) => [r.latestAttempt!.id, r.latestAttempt!.teacher_feedback_text || ""]),
        ),
      );
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [assignment]);

  useEffect(() => {
    if (!open) {
      setExpanded(null);
      return;
    }
    load();
  }, [open, load]);

  /** Podepsané odkazy na přílohy žáka načteme až při rozbalení řádku. */
  const ensureAttachmentUrls = async (row: StudentRow) => {
    const missing = row.attachments.filter((a) => !attachUrls[a.id]);
    if (missing.length === 0) return;
    const entries = await Promise.all(
      missing.map(async (a) => [a.id, (await getStudentAttachmentSignedUrl(a.file_path)) || ""] as const),
    );
    setAttachUrls((prev) => ({ ...prev, ...Object.fromEntries(entries.filter(([, url]) => url)) }));
  };

  const patchAttempt = async (row: StudentRow, patch: Record<string, unknown>) => {
    const attempt = row.latestAttempt;
    if (!attempt) return;
    setSavingId(attempt.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const full = {
        ...patch,
        teacher_feedback_at: new Date().toISOString(),
        teacher_feedback_by: user?.id ?? null,
      };
      const { error } = await supabase
        .from("assignment_attempts" as any)
        .update(full as any)
        .eq("id", attempt.id);
      if (error) throw error;

      // Notifikaci žákovi pošleme jen při skutečné změně hodnoty zpětné vazby.
      const emojiChanged =
        "teacher_feedback_emoji" in patch &&
        (patch.teacher_feedback_emoji ?? null) !== (attempt.teacher_feedback_emoji ?? null);
      const textChanged =
        "teacher_feedback_text" in patch &&
        (patch.teacher_feedback_text ?? null) !== (attempt.teacher_feedback_text ?? null);
      if ((emojiChanged || textChanged) && user && assignment) {
        const nextEmoji = "teacher_feedback_emoji" in patch
          ? (patch.teacher_feedback_emoji as string | null)
          : attempt.teacher_feedback_emoji;
        const nextText = "teacher_feedback_text" in patch
          ? (patch.teacher_feedback_text as string | null)
          : attempt.teacher_feedback_text;
        const snippet = nextText ? (nextText.length > 140 ? nextText.slice(0, 140) + "…" : nextText) : null;
        const body = snippet
          ? snippet
          : nextEmoji
            ? `Učitel zareagoval ${nextEmoji} na tvé odevzdání úkolu „${assignment.title}“.`
            : `Učitel aktualizoval zpětnou vazbu k úkolu „${assignment.title}“.`;
        // Chybu notifikace hlásíme viditelně – hodnocení už uložené je,
        // ale učitel musí vědět, že se žákovi neozvalo upozornění.
        const { error: notifyError } = await supabase.from("notifications").insert({
          recipient_id: row.studentId,
          sender_id: user.id,
          sender_role: "teacher",
          type: "assignment_feedback",
          title: "Nová zpětná vazba k úkolu",
          body,
          link: `/n/${assignment.id}`,
          status: "sent",
          sent_at: new Date().toISOString(),
          payload: { assignment_id: assignment.id, attempt_id: attempt.id },
        } as any);
        if (notifyError) {
          console.warn("[patchAttempt] notification insert failed", notifyError);
          toast({
            title: "Hodnocení uloženo, ale upozornění se neodeslalo",
            description: notifyError.message,
            variant: "destructive",
          });
        }
      }

      setStudents((prev) =>
        prev.map((r) =>
          r.studentId === row.studentId && r.latestAttempt
            ? { ...r, latestAttempt: { ...r.latestAttempt, ...(full as any) } }
            : r,
        ),
      );
      toast({ title: "Hodnocení uloženo" });
    } catch (e: any) {
      toast({ title: "Chyba", description: e.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  const toggleRow = (row: StudentRow) => {
    const next = expanded === row.studentId ? null : row.studentId;
    setExpanded(next);
    if (next) void ensureAttachmentUrls(row);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{assignment?.title}</DialogTitle>
        </DialogHeader>

        {assignment && (
          <div className="space-y-4">
            {assignment.description && (
              <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-sm">
                {assignment.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              {assignment.deadline
                ? `Termín: ${format(new Date(assignment.deadline), "d. M. yyyy HH:mm", { locale: cs })}`
                : "Bez termínu"}
            </div>

            {linkedLesson && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
                <div className="flex items-center gap-2 text-sm">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{linkedLesson.title}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => window.open(linkedLesson.url, "_blank")}>
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Otevřít
                </Button>
              </div>
            )}

            <AssignmentMaterialsList materials={materials} />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Odevzdání žáků</h4>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : students.length === 0 ? (
                <p className="text-sm text-muted-foreground">Žádní žáci k zobrazení.</p>
              ) : (
                <ul className="space-y-2">
                  {students.map((s) => {
                    const cfg = STATUS_CONFIG[s.status];
                    const StatusIcon = cfg.icon;
                    const isOpen = expanded === s.studentId;
                    const attempt = s.latestAttempt;
                    const answerCount = attempt?.answers ? Object.keys(attempt.answers).length : 0;
                    return (
                      <li key={s.studentId} className="rounded-lg border border-border">
                        <button
                          type="button"
                          onClick={() => toggleRow(s)}
                          className="flex w-full items-center gap-2 p-3 text-left hover:bg-muted/40"
                        >
                          {isOpen ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
                          <span className="flex-1 truncate text-sm font-medium">
                            {s.lastName} {s.firstName}
                            {!s.lastName && !s.firstName && (s.email || "Žák")}
                          </span>
                          {attempt?.teacher_feedback_emoji && (
                            <span className="text-base" aria-label="Reakce učitele">
                              {attempt.teacher_feedback_emoji}
                            </span>
                          )}
                          {s.bestScore !== null && (
                            <Badge variant="outline" className="text-[10px]">
                              {s.bestScore}{s.maxScore !== null ? ` / ${s.maxScore}` : ""}
                            </Badge>
                          )}
                          <Badge className={cn(cfg.className, "text-[10px]")}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {cfg.label}
                          </Badge>
                          <span className="hidden sm:inline text-[11px] text-muted-foreground">
                            {s.lastActivity
                              ? format(new Date(s.lastActivity), "d. M. HH:mm", { locale: cs })
                              : "–"}
                          </span>
                        </button>

                        {/* Už zapsané slovní hodnocení vidí učitel i bez rozbalení. */}
                        {!isOpen && attempt?.teacher_feedback_text && (
                          <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground line-clamp-2">
                            <MessageSquare className="mr-1 inline w-3 h-3" />
                            {attempt.teacher_feedback_text}
                          </p>
                        )}

                        {isOpen && (
                          <div className="space-y-3 border-t border-border p-3">
                            {!attempt ? (
                              <p className="text-sm text-muted-foreground">Žák úlohu ještě nezahájil.</p>
                            ) : (
                              <>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                  <span>{answerCount} {answerCount === 1 ? "odpověď" : "odpovědí"}</span>
                                  <span>·</span>
                                  <span>{s.attemptCount} {s.attemptCount === 1 ? "pokus" : "pokusů"}</span>
                                  {attempt.submitted_at && (
                                    <>
                                      <span>·</span>
                                      <span>{new Date(attempt.submitted_at).toLocaleString("cs-CZ")}</span>
                                    </>
                                  )}
                                </div>

                                <div>
                                  <h5 className="mb-1 text-xs font-semibold">Poznámka žáka</h5>
                                  {attempt.submission_note ? (
                                    <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-2 text-sm">
                                      {attempt.submission_note}
                                    </p>
                                  ) : (
                                    <p className="text-sm text-muted-foreground">Bez poznámky.</p>
                                  )}
                                </div>

                                <div>
                                  <h5 className="mb-1 text-xs font-semibold">Přílohy</h5>
                                  {s.attachments.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">Žádné přílohy.</p>
                                  ) : (
                                    <ul className="space-y-1">
                                      {s.attachments.map((a) => (
                                        <li key={a.id} className="flex items-center gap-2 text-sm">
                                          <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
                                          <span className="flex-1 truncate">{a.file_name}</span>
                                          {attachUrls[a.id] && (
                                            <a
                                              href={attachUrls[a.id]}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                            >
                                              <ExternalLink className="w-3 h-3" /> Otevřít
                                            </a>
                                          )}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>

                                {/* Zpětná vazba učitele */}
                                <div className="space-y-2 rounded-md border border-border bg-muted/20 p-3">
                                  <h5 className="text-xs font-semibold">Zpětná vazba pro žáka</h5>
                                  <div className="flex flex-wrap gap-1.5">
                                    {FEEDBACK_EMOJIS.map((emoji) => {
                                      const active = attempt.teacher_feedback_emoji === emoji;
                                      return (
                                        <Button
                                          key={emoji}
                                          type="button"
                                          size="sm"
                                          variant={active ? "default" : "outline"}
                                          className="h-8 w-9 p-0 text-base"
                                          disabled={savingId === attempt.id}
                                          aria-pressed={active}
                                          aria-label={`Reakce ${emoji}`}
                                          onClick={() =>
                                            patchAttempt(s, { teacher_feedback_emoji: active ? null : emoji })
                                          }
                                        >
                                          {emoji}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                  <Textarea
                                    rows={3}
                                    placeholder="Slovní hodnocení pro žáka…"
                                    value={drafts[attempt.id] ?? ""}
                                    onChange={(e) =>
                                      setDrafts((prev) => ({ ...prev, [attempt.id]: e.target.value }))
                                    }
                                  />
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      disabled={savingId === attempt.id}
                                      onClick={() =>
                                        patchAttempt(s, {
                                          teacher_feedback_text: (drafts[attempt.id] ?? "").trim() || null,
                                        })
                                      }
                                    >
                                      {savingId === attempt.id ? (
                                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Save className="mr-1.5 h-3.5 w-3.5" />
                                      )}
                                      Uložit hodnocení
                                    </Button>
                                    {attempt.teacher_feedback_at && (
                                      <span className="text-[11px] text-muted-foreground">
                                        Naposledy {new Date(attempt.teacher_feedback_at).toLocaleString("cs-CZ")}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AssignmentDetailDialog;

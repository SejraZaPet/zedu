/**
 * Sdílená logika pracovního listu zadaného jako úkol (assignment_attempts).
 * Používá ji StudentAssignmentPlayer i digitální stránka sešitu, aby obě cesty
 * odevzdávaly tentýž pokus stejnými pravidly (termín, povinné aktivity, snapshot pera).
 */
import { supabase } from "@/integrations/supabase/client";
import { fetchLessonActivities } from "@/lib/lesson-activity-index";
import { bestAttempt } from "@/lib/best-results";
import { SNAPSHOT_KEY, snapshotPenPagesForAttempt } from "@/lib/worksheet-notebook";

export interface WsAssignmentLike {
  id: string;
  deadline: string | null;
  max_attempts: number;
  worksheet_id?: string | null;
  lesson_id?: string | null;
  lesson_source?: string | null;
  group_mode?: string | null;
  lockdown_mode?: boolean | null;
  settings?: any;
  status?: string | null;
}

export interface WsAttemptLike {
  id: string;
  status: string;
  attempt_number: number;
  answers?: any;
  score?: number | null;
  max_score?: number | null;
  submitted_at?: string | null;
}

/** Vrací splnění povinných aktivit lekce, nebo null když lekce povinné aktivity nemá. */
export async function checkLessonGate(
  lessonId: string,
  lessonSource: string | null,
  userId: string,
): Promise<{ done: number; total: number } | null> {
  const activities = await fetchLessonActivities(lessonId, lessonSource);
  const requiredIdx = activities.filter((a) => a.required).map((a) => a.index);
  if (requiredIdx.length === 0) return null;
  const { data, error } = await supabase
    .from("student_activity_results")
    .select("activity_index")
    .eq("lesson_id", lessonId)
    .eq("user_id", userId);
  if (error) throw error;
  const doneSet = new Set(((data as any[]) || []).map((r) => r.activity_index).filter((i) => requiredIdx.includes(i)));
  return { done: doneSet.size, total: requiredIdx.length };
}

export function isDeadlinePassed(deadline: string | null | undefined, now = Date.now()): boolean {
  return !!deadline && new Date(deadline).getTime() < now;
}

export function revealsCorrectAnswers(assignment: Pick<WsAssignmentLike, "settings"> | null | undefined): boolean {
  return !!((assignment?.settings as any)?.show_correct_answers ?? (assignment?.settings as any)?.showCorrectAnswers);
}

export type AttemptDecision<A extends WsAttemptLike> =
  | { kind: "resume"; attempt: A }
  | { kind: "create"; attemptNumber: number }
  | { kind: "view"; attempt: A | null; reason: "deadline" | "exhausted" };

/**
 * Stejná pravidla jako StudentAssignmentPlayer pro individuální úkol:
 * po termínu nikdy nový pokus; rozpracovaný se obnoví; jinak nový, dokud nejsou vyčerpané pokusy.
 */
export function decideAttempt<A extends WsAttemptLike>(
  assignment: Pick<WsAssignmentLike, "deadline" | "max_attempts">,
  attempts: A[],
  now = Date.now(),
): AttemptDecision<A> {
  const sorted = [...attempts].sort((a, b) => b.attempt_number - a.attempt_number);
  const inProgress = sorted.find((a) => a.status === "in_progress");
  const best = bestAttempt(sorted as any) as A | null | undefined;
  if (isDeadlinePassed(assignment.deadline, now)) {
    return { kind: "view", attempt: (best ?? inProgress ?? sorted[0] ?? null) as A | null, reason: "deadline" };
  }
  if (inProgress) return { kind: "resume", attempt: inProgress };
  if (sorted.length < assignment.max_attempts) return { kind: "create", attemptNumber: sorted.length + 1 };
  return { kind: "view", attempt: (best ?? sorted[0] ?? null) as A | null, reason: "exhausted" };
}

/** Načte nebo založí individuální pokus podle decideAttempt (tytéž sloupce jako StudentAssignmentPlayer). */
export async function loadOrCreateIndividualAttempt(
  assignment: WsAssignmentLike, userId: string,
): Promise<{ attempt: WsAttemptLike | null; decision: AttemptDecision<WsAttemptLike>; used: number }> {
  const { data, error } = await supabase
    .from("assignment_attempts" as any)
    .select("*")
    .eq("assignment_id", assignment.id)
    .eq("student_id", userId)
    .order("attempt_number", { ascending: false });
  if (error) throw error;
  const existing = ((data as any[]) || []) as WsAttemptLike[];
  const decision = decideAttempt(assignment, existing);
  if (decision.kind === "resume") return { attempt: decision.attempt, decision, used: existing.length };
  if (decision.kind === "view") return { attempt: decision.attempt, decision, used: existing.length };
  const { data: created, error: cErr } = await supabase
    .from("assignment_attempts" as any)
    .insert({
      assignment_id: assignment.id,
      student_id: userId,
      group_id: null,
      attempt_number: decision.attemptNumber,
      status: "in_progress",
      answers: {},
      progress: { currentIndex: 0, completed: [] },
      last_edited_by: userId,
      last_edited_at: new Date().toISOString(),
    } as any)
    .select()
    .single();
  if (cErr) throw cErr;
  return { attempt: created as any as WsAttemptLike, decision, used: existing.length + 1 };
}

export type SubmitResult = { ok: true } | { ok: false; title: string; message: string };

/** Odevzdá pokus listu: termín → povinné aktivity → snapshot stránek pera → update pokusu. */
export async function submitWorksheetAttempt(opts: {
  assignment: WsAssignmentLike;
  attemptId: string;
  studentId: string;
  answers: Record<string, any>;
  score: number;
  maxScore: number;
  /** Kontrola povinných aktivit; vrací false, když se odevzdat nemá (hlášku zobrazí sama). */
  gate: () => Promise<boolean>;
}): Promise<SubmitResult | "gated"> {
  const { assignment, attemptId, studentId, answers, score, maxScore } = opts;
  if (isDeadlinePassed(assignment.deadline)) {
    return { ok: false, title: "Termín vypršel", message: "Po termínu už úkol nejde odevzdat." };
  }
  if (!(await opts.gate())) return "gated";
  let finalAnswers: Record<string, any> = answers;
  if (assignment.worksheet_id && studentId) {
    try {
      const snap = await snapshotPenPagesForAttempt({
        worksheetId: assignment.worksheet_id, assignmentId: assignment.id, studentId, attemptId,
      });
      if (snap) finalAnswers = { ...answers, [SNAPSHOT_KEY]: snap };
    } catch (e: any) {
      return { ok: false, title: "Stránky ze sešitu se nepřiložily", message: e?.message || "Zkus odevzdat znovu později." };
    }
  }
  const { error } = await supabase
    .from("assignment_attempts" as any)
    .update({
      status: "submitted",
      answers: finalAnswers as any,
      score,
      max_score: maxScore,
      submitted_at: new Date().toISOString(),
      last_edited_by: studentId,
      last_edited_at: new Date().toISOString(),
    } as any)
    .eq("id", attemptId);
  if (error) return { ok: false, title: "Chyba", message: error.message };
  return { ok: true };
}

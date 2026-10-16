import { bestAttempt, type AttemptResultRow } from "@/lib/best-results";

export type AssignmentState = "pending" | "soon" | "submitted" | "overdue" | "graded" | "preparing";
export type AssignmentGroup = Exclude<AssignmentState, "soon">;
export interface StatusAssignment {
  deadline?: string | null;
  exam_type?: string | null;
  status?: string;
  scheduled_publish_at?: string | null;
}
export interface StatusAttempt extends AttemptResultRow {
  student_id?: string;
  group_id?: string | null;
}
export interface ClassProgress { submitted: number; total: number; graded: number }
export interface AssignmentStatus { state: AssignmentState; group: AssignmentGroup; label: string }

export const ASSIGNMENT_GROUPS: { key: AssignmentGroup; label: string }[] = [
  { key: "pending", label: "K odevzdání" },
  { key: "submitted", label: "Odevzdáno" },
  { key: "overdue", label: "Po termínu" },
  { key: "graded", label: "Ohodnoceno" },
  { key: "preparing", label: "Připravuje se" },
];

/** A null score is ungraded; zero is a valid grade. Only submitted work counts. */
export function isGradedAttempt(attempt: StatusAttempt): boolean {
  return attempt.status === "submitted" && attempt.score != null;
}

export function assignmentStatus(
  assignment: StatusAssignment,
  attempts: readonly StatusAttempt[] = [],
  now: Date = new Date(),
  classProgress?: ClassProgress,
): AssignmentStatus {
  const date = assignment.scheduled_publish_at ? new Date(assignment.scheduled_publish_at) : null;
  if (classProgress && (assignment.status === "draft" || assignment.status === "scheduled" || (date && date > now))) {
    return { state: "preparing", group: "preparing", label: date && Number.isFinite(date.getTime())
      ? `Od ${date.toLocaleString("cs-CZ", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })}`
      : "Koncept" };
  }
  const submitted = attempts.filter((a) => a.status === "submitted");
  const best = bestAttempt(submitted);
  const allSubmitted = classProgress ? classProgress.total > 0 && classProgress.submitted >= classProgress.total : submitted.length > 0;
  const allGraded = classProgress ? allSubmitted && classProgress.graded >= classProgress.total : !!best && isGradedAttempt(best);
  if (allGraded) return { state: "graded", group: "graded", label: classProgress
    ? `Ohodnoceno ${classProgress.graded}/${classProgress.total}`
    : best?.max_score != null ? `${best.score} / ${best.max_score}` : "Ohodnoceno" };
  if (allSubmitted) return { state: "submitted", group: "submitted", label: "Čeká na hodnocení" };
  const deadline = assignment.deadline ? new Date(assignment.deadline).getTime() : NaN;
  const remaining = deadline - now.getTime();
  if (remaining <= 0) return { state: "overdue", group: "overdue", label: "Po termínu" };
  if (remaining <= 24 * 60 * 60 * 1000) return { state: "soon", group: "pending", label:
    new Date(deadline).toLocaleDateString("cs-CZ") === now.toLocaleDateString("cs-CZ") ? "Končí dnes" : "Končí zítra" };
  return { state: "pending", group: "pending", label: assignment.exam_type === "prace_v_hodine" && !assignment.deadline ? "V hodině" : "K odevzdání" };
}

/** Deduplicates attempts per roster member, including shared group submissions. */
export function assignmentClassProgress(
  attempts: readonly StatusAttempt[],
  memberIds: readonly string[],
  groupMembers: readonly { group_id: string; student_id: string }[] = [],
): ClassProgress {
  const ids = [...new Set(memberIds)];
  let submitted = 0;
  let graded = 0;
  for (const id of ids) {
    const groups = new Set(groupMembers.filter((m) => m.student_id === id).map((m) => m.group_id));
    const rows = attempts.filter((a) => a.student_id === id || (a.group_id && groups.has(a.group_id)));
    const best = bestAttempt(rows);
    if (best) { submitted++; if (isGradedAttempt(best)) graded++; }
  }
  return { submitted, graded, total: ids.length };
}

export function sortStatusAssignments<T extends StatusAssignment>(items: readonly T[], statusOf: (item: T) => AssignmentStatus): T[] {
  const time = (value?: string | null) => {
    const t = value ? new Date(value).getTime() : NaN;
    return Number.isFinite(t) ? t : Infinity;
  };
  return [...items].sort((a, b) => {
    const soon = Number(statusOf(b).state === "soon") - Number(statusOf(a).state === "soon");
    return soon || time(a.deadline) - time(b.deadline);
  });
}
import { bestAttempt, type AttemptResultRow } from "@/lib/best-results";
import { assignmentKind, lateLimit } from "@/lib/assignment-kind";

export type AssignmentState =
  | "pending" | "soon" | "submitted" | "overdue" | "graded" | "preparing"
  | "review" | "closed" | "material" | "announcement";
export type AssignmentGroup = Exclude<AssignmentState, "soon">;
export interface StatusAssignment {
  deadline?: string | null;
  exam_type?: string | null;
  status?: string;
  scheduled_publish_at?: string | null;
  settings?: unknown;
}
export interface StatusAttempt extends AttemptResultRow {
  student_id?: string;
  group_id?: string | null;
  submitted_at?: string | null;
}
export interface ClassProgress { submitted: number; total: number; graded: number }
/** Barva štítku „Odevzdalo X/Y“: všichni / část / nikdo / nikdo po termínu. */
export type ProgressTone = "all" | "some" | "none" | "none-overdue";
export interface AssignmentStatus {
  state: AssignmentState; group: AssignmentGroup; label: string;
  /** Doplňkové textové štítky, např. „Odevzdáno po termínu“. */
  badges?: string[];
  progress?: { text: string; tone: ProgressTone };
}

/** Žák: pořadí skupin. */
export const ASSIGNMENT_GROUPS: { key: AssignmentGroup; label: string }[] = [
  { key: "announcement", label: "Oznámení" },
  { key: "pending", label: "K odevzdání" },
  { key: "overdue", label: "Po termínu" },
  { key: "submitted", label: "Odevzdané" },
  { key: "graded", label: "Zkontrolované" },
  { key: "material", label: "Materiály" },
  { key: "preparing", label: "Připravuje se" },
];
/** Učitel: pořadí skupin. */
export const TEACHER_ASSIGNMENT_GROUPS: { key: AssignmentGroup; label: string }[] = [
  { key: "review", label: "Ke kontrole" },
  { key: "pending", label: "Probíhá" },
  { key: "graded", label: "Zkontrolované" },
  { key: "closed", label: "Uzavřené" },
  { key: "announcement", label: "Oznámení" },
  { key: "material", label: "Materiály" },
  { key: "preparing", label: "Připravuje se" },
];

export const LATE_BADGE = "Odevzdáno po termínu";
export const LATE_DRAFT_LABEL = "Po termínu – rozpracováno";

/** A null score is ungraded; zero is a valid grade. Only submitted work counts. */
export function isGradedAttempt(attempt: StatusAttempt): boolean {
  return attempt.status === "submitted" && attempt.score != null;
}

const fmtDate = (d: Date) => d.toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });

export function progressBadge(p: ClassProgress, deadlinePassed: boolean): { text: string; tone: ProgressTone } {
  const tone: ProgressTone = p.total > 0 && p.submitted >= p.total ? "all"
    : p.submitted > 0 ? "some" : deadlinePassed ? "none-overdue" : "none";
  return { text: `Odevzdalo ${p.submitted}/${p.total}`, tone };
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
  const kind = assignmentKind(assignment.settings);
  if (kind === "material") return { state: "material", group: "material", label: "Materiál" };
  if (kind === "announcement") return { state: "announcement", group: "announcement", label: "Oznámení" };

  const deadline = assignment.deadline ? new Date(assignment.deadline).getTime() : NaN;
  const deadlinePassed = Number.isFinite(deadline) && deadline - now.getTime() <= 0;

  if (classProgress) {
    const p = classProgress;
    const progress = progressBadge(p, deadlinePassed);
    if (p.submitted > p.graded) return { state: "review", group: "review", label: `Ke kontrole ${p.submitted - p.graded}`, progress };
    if (p.submitted > 0 && (deadlinePassed || p.submitted >= p.total)) return { state: "graded", group: "graded", label: "Zkontrolováno", progress };
    if (deadlinePassed) return { state: "closed", group: "closed", label: "Uzavřeno", progress };
    return { state: "pending", group: "pending", label: "Probíhá", progress };
  }

  const submitted = attempts.filter((a) => a.status === "submitted");
  const best = bestAttempt(submitted) as StatusAttempt | null;
  const late = Number.isFinite(deadline) && submitted.some((a) => a.submitted_at && new Date(a.submitted_at).getTime() > deadline);
  const badges = late ? [LATE_BADGE] : undefined;
  if (best && isGradedAttempt(best)) return { state: "graded", group: "graded", badges,
    label: best.max_score != null ? `${best.score} / ${best.max_score}` : "Zkontrolováno" };
  if (best) return { state: "submitted", group: "submitted", label: "Odevzdáno", badges };
  if (deadlinePassed) {
    const limit = lateLimit(assignment.settings);
    const open = limit === Infinity || (limit instanceof Date && limit.getTime() >= now.getTime());
    const draft = attempts.some((a) => a.status === "in_progress");
    const extra = open ? [limit === Infinity ? "Lze odevzdat i po termínu" : `Lze odevzdat do ${fmtDate(limit as Date)}`] : undefined;
    return { state: "overdue", group: "overdue", label: draft ? LATE_DRAFT_LABEL : "Neodevzdáno", badges: extra };
  }
  const remaining = deadline - now.getTime();
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
  const pinned = (a: T) => Number(!!(a.settings && typeof a.settings === "object" && (a.settings as Record<string, unknown>).pinned === true));
  return [...items].sort((a, b) => {
    const pin = pinned(b) - pinned(a);
    const soon = Number(statusOf(b).state === "soon") - Number(statusOf(a).state === "soon");
    return pin || soon || time(a.deadline) - time(b.deadline);
  });
}

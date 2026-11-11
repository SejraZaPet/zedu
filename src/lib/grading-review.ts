import { matchesSearch } from "@/lib/picker-search";

/**
 * Pomocné funkce pro obrazovku „Ke kontrole“ (etapy 1+2).
 * Vše se ukládá do existujících sloupců pokusu (progress._teacher_grading,
 * teacher_feedback_*). Hromadné akce NIKDY nemění score ani status,
 * aby se nespustily rodičovské notifikační triggery.
 */

export interface GradingState {
  items?: Record<string, { points: number; max: number; comment?: string }>;
  total?: number;
  max?: number;
  graded_at?: string;
  graded_by?: string | null;
  /** Etapa 2: učitel pokus zkontroloval (i když body nechal automatické). */
  reviewed?: boolean;
  reviewed_at?: string;
  reviewed_by?: string | null;
  /** Etapa 2: předchozí hodnoty pro „Vrátit zpět“ poslední hromadné akce. */
  undo?: {
    at: string;
    action: "reviewed" | "comment";
    grading: GradingState | null;
    feedback_text: string | null;
    feedback_emoji: string | null;
  };
}

export interface ReviewAssignment {
  id: string;
  title: string;
  class_id?: string | null;
  group_id?: string | null;
  worksheet_id?: string | null;
  settings?: unknown;
}

export interface ReviewAttempt {
  id: string;
  assignment_id: string;
  student_id: string;
  status: string;
  score: number | null;
  max_score: number | null;
  submitted_at: string | null;
  attempt_number: number;
  group_id?: string | null;
  answers?: unknown;
  progress?: unknown;
  teacher_feedback_text?: string | null;
  teacher_feedback_emoji?: string | null;
}

export interface ReviewRow {
  /** Klíč řádku = id pokusu. */
  attemptId: string;
  assignmentId: string;
  assignmentTitle: string;
  studentId: string;
  studentName: string;
  /** Název třídy nebo skupiny (pro filtr a zobrazení). */
  targetId: string | null;
  targetName: string;
  submittedAt: string | null;
  score: number | null;
  maxScore: number | null;
  reviewed: boolean;
  hasOpenAnswers: boolean;
  /** Skupinové odevzdání – hodnotí se pokus skupiny, ne dvakrát. */
  groupSubmission: boolean;
  attempt: ReviewAttempt;
  worksheetId: string | null;
}

export type ReviewStateFilter = "pending" | "reviewed" | "all";

export function readGrading(progress: unknown): GradingState | null {
  if (!progress || typeof progress !== "object") return null;
  const g = (progress as Record<string, unknown>)._teacher_grading;
  if (!g || typeof g !== "object") return null;
  return g as GradingState;
}

export function isReviewed(progress: unknown): boolean {
  return isAttemptReviewed(progress);
}

/** JEDINÁ definice „pokus zkontroloval učitel“: označeno Zkontrolováno nebo uložené ruční hodnocení. */
export function isAttemptReviewed(progress: unknown): boolean {
  const g = readGrading(progress);
  return g?.reviewed === true || (typeof g?.graded_at === "string" && g.graded_at.length > 0);
}

/** Typy položek, které se nehodnotí automaticky (otevřené odpovědi). */
const OPEN_ITEM_TYPES = new Set(["open_answer", "offline_activity", "two_boxes", "blank_box"]);

/** Má pokus aspoň jednu položku vyžadující ruční kontrolu? Čte spec listu. */
export function attemptHasOpenAnswers(spec: unknown, answers: unknown): boolean {
  if (!spec || typeof spec !== "object" || !answers || typeof answers !== "object") return false;
  const ans = answers as Record<string, unknown>;
  const items = new Map<string, { type?: string }>();
  for (const v of ((spec as any).variants ?? []) as any[]) {
    for (const it of v.items ?? []) if (!items.has(it.id)) items.set(it.id, it);
  }
  for (const id of Object.keys(ans)) {
    if (id.startsWith("_")) continue;
    const item = items.get(id);
    if (item && OPEN_ITEM_TYPES.has(String(item.type))) return true;
  }
  return false;
}

interface BuildInput {
  assignments: ReviewAssignment[];
  attempts: ReviewAttempt[];
  profiles: Record<string, { first_name: string; last_name: string }>;
  /** id třídy/skupiny → název. */
  targetNames: Record<string, string>;
  /** worksheetId → spec (pro detekci otevřených odpovědí); chybějící = neznámé. */
  worksheetSpecs?: Record<string, unknown>;
}

/**
 * Sestaví řádky „Ke kontrole“: jen odevzdané pokusy z předaných úkolů
 * (úkoly už musí být vyfiltrované přes submittableOnly). U žáka s více
 * odevzdanými pokusy se ukáže ten nejnovější; skupinové odevzdání se
 * započítá jednou (jeden pokus = jeden řádek).
 */
export function buildReviewRows(input: BuildInput): ReviewRow[] {
  const asgById = new Map(input.assignments.map((a) => [a.id, a]));
  const byStudent = new Map<string, ReviewAttempt>();
  for (const at of input.attempts) {
    if (at.status !== "submitted") continue;
    if (!asgById.has(at.assignment_id)) continue;
    const key = `${at.assignment_id}:${at.student_id}`;
    const prev = byStudent.get(key);
    if (!prev || String(at.submitted_at ?? "") > String(prev.submitted_at ?? "")) {
      byStudent.set(key, at);
    }
  }
  const rows: ReviewRow[] = [];
  for (const at of byStudent.values()) {
    const asg = asgById.get(at.assignment_id)!;
    const p = input.profiles[at.student_id];
    const targetId = asg.group_id ?? asg.class_id ?? null;
    rows.push({
      attemptId: at.id,
      assignmentId: asg.id,
      assignmentTitle: asg.title,
      studentId: at.student_id,
      studentName: p ? `${p.last_name} ${p.first_name}`.trim() || "Žák" : "Žák",
      targetId,
      targetName: (targetId && input.targetNames[targetId]) || "—",
      submittedAt: at.submitted_at,
      score: at.score,
      maxScore: at.max_score,
      reviewed: isReviewed(at.progress),
      hasOpenAnswers: attemptHasOpenAnswers(
        asg.worksheet_id ? input.worksheetSpecs?.[asg.worksheet_id] : undefined,
        at.answers,
      ),
      groupSubmission: at.group_id != null,
      attempt: at,
      worksheetId: asg.worksheet_id ?? null,
    });
  }
  // Nejstarší nezkontrolované nahoře – co čeká nejdéle, kontroluje se dřív.
  return rows.sort((a, b) => String(a.submittedAt ?? "").localeCompare(String(b.submittedAt ?? "")));
}

export interface ReviewFilters {
  assignmentId?: string | null;
  targetId?: string | null;
  state?: ReviewStateFilter;
  openOnly?: boolean;
  query?: string;
}

export function filterReviewRows(rows: ReviewRow[], f: ReviewFilters): ReviewRow[] {
  return rows.filter((r) => {
    if (f.assignmentId && r.assignmentId !== f.assignmentId) return false;
    if (f.targetId && r.targetId !== f.targetId) return false;
    if (f.state === "pending" && r.reviewed) return false;
    if (f.state === "reviewed" && !r.reviewed) return false;
    if (f.openOnly && !r.hasOpenAnswers) return false;
    if (f.query && !matchesSearch(f.query, r.studentName, r.assignmentTitle)) return false;
    return true;
  });
}

/** Procházení po jednom: vrátí index dalšího/předchozího řádku (bez zacyklení). */
export function moveReviewIndex(current: number, delta: 1 | -1, count: number): number {
  if (count <= 0) return -1;
  const next = current + delta;
  if (next < 0) return 0;
  if (next >= count) return count - 1;
  return next;
}

export interface BulkPatch {
  /** Nová hodnota progress (vč. _teacher_grading). Nikdy score/status. */
  progress: Record<string, unknown>;
  teacher_feedback_text?: string | null;
  teacher_feedback_at: string;
  teacher_feedback_by: string | null;
}

/**
 * Připraví patch pro hromadné označení „zkontrolováno“.
 * Nemění score, max_score ani status – jen progress._teacher_grading.
 */
export function prepareMarkReviewed(
  attempt: ReviewAttempt,
  now: string,
  by: string | null,
): BulkPatch {
  const prevProgress =
    attempt.progress && typeof attempt.progress === "object"
      ? (attempt.progress as Record<string, unknown>)
      : {};
  const prevGrading = readGrading(attempt.progress);
  const grading: GradingState = {
    ...(prevGrading ?? {}),
    reviewed: true,
    reviewed_at: now,
    reviewed_by: by,
    undo: {
      at: now,
      action: "reviewed",
      grading: prevGrading,
      feedback_text: attempt.teacher_feedback_text ?? null,
      feedback_emoji: attempt.teacher_feedback_emoji ?? null,
    },
  };
  return {
    progress: { ...prevProgress, _teacher_grading: grading },
    teacher_feedback_at: now,
    teacher_feedback_by: by,
  };
}

/**
 * Připraví patch pro hromadný stejný komentář vybraným žákům.
 * Nemění score, max_score ani status.
 */
export function prepareBulkComment(
  attempt: ReviewAttempt,
  text: string,
  now: string,
  by: string | null,
): BulkPatch {
  const prevProgress =
    attempt.progress && typeof attempt.progress === "object"
      ? (attempt.progress as Record<string, unknown>)
      : {};
  const prevGrading = readGrading(attempt.progress);
  const grading: GradingState = {
    ...(prevGrading ?? {}),
    undo: {
      at: now,
      action: "comment",
      grading: prevGrading,
      feedback_text: attempt.teacher_feedback_text ?? null,
      feedback_emoji: attempt.teacher_feedback_emoji ?? null,
    },
  };
  return {
    progress: { ...prevProgress, _teacher_grading: grading },
    teacher_feedback_text: text,
    teacher_feedback_at: now,
    teacher_feedback_by: by,
  };
}

/**
 * Připraví patch pro „Vrátit zpět“ poslední hromadné akce.
 * Vrátí null, když není co vracet. Obnoví jen progress a teacher_feedback_*.
 */
export function prepareUndo(attempt: ReviewAttempt, now: string, by: string | null): BulkPatch | null {
  const grading = readGrading(attempt.progress);
  const undo = grading?.undo;
  if (!undo) return null;
  const prevProgress =
    attempt.progress && typeof attempt.progress === "object"
      ? (attempt.progress as Record<string, unknown>)
      : {};
  const restored: GradingState | null = undo.grading
    ? { ...undo.grading, undo: undefined }
    : null;
  const nextProgress = { ...prevProgress };
  if (restored) {
    delete (restored as Record<string, unknown>).undo;
    nextProgress._teacher_grading = restored;
  } else {
    delete nextProgress._teacher_grading;
  }
  return {
    progress: nextProgress,
    teacher_feedback_text: undo.feedback_text,
    teacher_feedback_at: now,
    teacher_feedback_by: by,
  };
}

/* --- Šablony komentářů (etapa 2) – ukládají se v prohlížeči učitelky. --- */

export const COMMENT_TEMPLATES_KEY = "bezli-grading-comment-templates-v1";

export const DEFAULT_COMMENT_TEMPLATES = [
  "Výborná práce!",
  "Dobrá práce, jen drobné chyby.",
  "Doplň zdůvodnění své odpovědi.",
  "Zkontroluj si výpočty, někde je chyba.",
  "Příště si po sobě práci přečti.",
];

export function loadCommentTemplates(storage: Pick<Storage, "getItem">): string[] {
  try {
    const raw = storage.getItem(COMMENT_TEMPLATES_KEY);
    if (!raw) return [...DEFAULT_COMMENT_TEMPLATES];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_COMMENT_TEMPLATES];
    const own = parsed.filter((t): t is string => typeof t === "string" && t.trim().length > 0);
    // Výchozí šablony zůstávají vždy k dispozici, vlastní se přidají za ně.
    return [...DEFAULT_COMMENT_TEMPLATES, ...own.filter((t) => !DEFAULT_COMMENT_TEMPLATES.includes(t))];
  } catch {
    return [...DEFAULT_COMMENT_TEMPLATES];
  }
}

export function saveCommentTemplate(
  storage: Pick<Storage, "getItem" | "setItem">,
  text: string,
): string[] {
  const trimmed = text.trim();
  const current = loadCommentTemplates(storage);
  if (!trimmed || current.includes(trimmed)) return current;
  const own = current.filter((t) => !DEFAULT_COMMENT_TEMPLATES.includes(t));
  const nextOwn = [...own, trimmed].slice(-20);
  storage.setItem(COMMENT_TEMPLATES_KEY, JSON.stringify(nextOwn));
  return loadCommentTemplates(storage);
}

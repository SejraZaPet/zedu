import { assignmentKind } from "@/lib/assignment-kind";

/** Počítadlo „nového" v předmětech žáka. Varianta A: čas poslední návštěvy v localStorage (po zařízení). */
export type NewsKind = "wall" | "material" | "task" | "test";
export interface SubjectNews { wall: number; material: number; task: number; test: number; total: number }
export interface NewsAssignment { settings?: unknown; exam_type?: string | null; created_at?: string | null; scheduled_publish_at?: string | null }

export const FIRST_VISIT_WINDOW_DAYS = 14;
export const EMPTY_NEWS: SubjectNews = { wall: 0, material: 0, task: 0, test: 0, total: 0 };

export function newsKindOf(a: NewsAssignment): NewsKind {
  const kind = assignmentKind(a.settings);
  if (kind === "announcement") return "wall";
  if (kind === "material") return "material";
  return a.exam_type ? "test" : "task";
}

export function publishedAt(a: NewsAssignment): number | null {
  const raw = a.scheduled_publish_at || a.created_at;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

export function countSubjectNews(items: NewsAssignment[], lastSeen: number | null, now: Date): SubjectNews {
  const since = lastSeen ?? now.getTime() - FIRST_VISIT_WINDOW_DAYS * 86_400_000;
  const out = { ...EMPTY_NEWS };
  for (const a of items) {
    const t = publishedAt(a);
    if (t == null || t <= since || t > now.getTime()) continue;
    out[newsKindOf(a)]++;
    out.total++;
  }
  return out;
}

export const formatNewsCount = (n: number) => (n > 99 ? "99+" : String(n));

const key = (userId: string, target: string) => `subject-seen:v1:${userId}:${target}`;

export function getSubjectSeen(userId: string, target: string): number | null {
  try {
    const v = localStorage.getItem(key(userId, target));
    const t = v ? new Date(v).getTime() : NaN;
    return Number.isFinite(t) ? t : null;
  } catch { return null; }
}

export function markSubjectSeen(userId: string, target: string, now = new Date()): void {
  try { localStorage.setItem(key(userId, target), now.toISOString()); } catch { /* soukromý režim */ }
}

const LABELS: Record<NewsKind, [string, string, string]> = {
  wall: ["nový příspěvek na zdi", "nové příspěvky na zdi", "nových příspěvků na zdi"],
  material: ["nový materiál", "nové materiály", "nových materiálů"],
  task: ["nový úkol", "nové úkoly", "nových úkolů"],
  test: ["nový test", "nové testy", "nových testů"],
};
export function newsLabel(kind: NewsKind, n: number): string {
  const [one, few, many] = LABELS[kind];
  return `${n} ${n === 1 ? one : n < 5 ? few : many}`;
}

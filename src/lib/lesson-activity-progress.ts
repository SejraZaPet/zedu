/**
 * Postup žáka v aktivitách lekce — jen čtení a výpočet, nic se neukládá.
 * V `student_activity_results` může být víc řádků na stejný `activity_index`
 * (opakované řešení); vždy se bere NEJLEPŠÍ výsledek, nezávisle na pořadí řádků.
 */
import { activityMeta } from "@/lib/activity-meta";
import type { LessonActivityInfo } from "@/lib/lesson-activity-index";

export interface ActivityResultRow {
  activity_index: number;
  score: number | null;
  max_score: number | null;
  completed_at?: string | null;
}

export interface BestActivityResult {
  score: number;
  maxScore: number;
  /** 0..1, nebo null když aktivita nemá body (max 0). */
  ratio: number | null;
  completedAt: string | null;
}

const ratioOf = (score: number, max: number) => (max > 0 ? Math.min(1, Math.max(0, score / max)) : null);

/** Lepší z dvou výsledků: vyšší poměr, při shodě vyšší skóre, při shodě dřívější dokončení. */
export function betterResult(a: BestActivityResult | undefined, b: BestActivityResult): BestActivityResult {
  if (!a) return b;
  const ra = a.ratio ?? -1;
  const rb = b.ratio ?? -1;
  if (rb !== ra) return rb > ra ? b : a;
  if (b.score !== a.score) return b.score > a.score ? b : a;
  if (a.completedAt && b.completedAt) return b.completedAt < a.completedAt ? b : a;
  return a;
}

export function toBestResult(r: ActivityResultRow): BestActivityResult {
  const score = Number(r.score) || 0;
  const maxScore = Number(r.max_score) || 0;
  return { score, maxScore, ratio: ratioOf(score, maxScore), completedAt: r.completed_at ?? null };
}

export function bestResultsByActivity(rows: ActivityResultRow[]): Map<number, BestActivityResult> {
  const map = new Map<number, BestActivityResult>();
  for (const r of rows ?? []) {
    if (typeof r?.activity_index !== "number") continue;
    map.set(r.activity_index, betterResult(map.get(r.activity_index), toBestResult(r)));
  }
  return map;
}

const GENERIC_TITLES = new Set(["", "aktivita"]);

/** Název aktivity: vlastní název, jinak typ („Kvíz“…). */
export function baseActivityTitle(title: unknown, type: string | undefined): string {
  const t = typeof title === "string" ? title.trim() : "";
  return GENERIC_TITLES.has(t.toLowerCase()) ? activityMeta(type).label : t;
}

/** Jednotné názvy: při shodě se přidá pořadí „(2)“, „(3)“… (první zůstává bez čísla). */
export function uniqueActivityTitles<T extends { title: string }>(list: T[]): T[] {
  const totals = new Map<string, number>();
  list.forEach((a) => totals.set(a.title, (totals.get(a.title) ?? 0) + 1));
  const seen = new Map<string, number>();
  return list.map((a) => {
    if ((totals.get(a.title) ?? 0) < 2) return a;
    const n = (seen.get(a.title) ?? 0) + 1;
    seen.set(a.title, n);
    return n === 1 ? a : { ...a, title: `${a.title} (${n})` };
  });
}

export interface ActivityProgressEntry {
  activity: LessonActivityInfo;
  best: BestActivityResult | null;
}

export interface LessonActivityProgress {
  required: ActivityProgressEntry[];
  /** Nepovinné aktivity, které žák dělal — do čísel povinných se nepočítají. */
  other: ActivityProgressEntry[];
  done: number;
  total: number;
  /** Skóre z povinných aktivit; nehotové = 0 %. */
  completionPct: number;
  /** Průměr jen z hotových bodovaných povinných aktivit. */
  completedAvgPct: number | null;
}

export function computeLessonActivityProgress(
  activities: LessonActivityInfo[],
  best: Map<number, BestActivityResult>,
): LessonActivityProgress {
  const required = activities.filter((a) => a.required).map((a) => ({ activity: a, best: best.get(a.index) ?? null }));
  const other = activities
    .filter((a) => !a.required && best.has(a.index))
    .map((a) => ({ activity: a, best: best.get(a.index)! }));
  const doneEntries = required.filter((e) => e.best);
  const scored = doneEntries.map((e) => e.best!.ratio).filter((r): r is number => r !== null);
  const sum = scored.reduce((s, v) => s + v, 0);
  const total = required.length;
  return {
    required,
    other,
    done: doneEntries.length,
    total,
    completionPct: total > 0 ? Math.round((sum / total) * 100) : 0,
    completedAvgPct: scored.length > 0 ? Math.round((sum / scored.length) * 100) : null,
  };
}

export function formatActivityScore(b: BestActivityResult): string {
  return b.maxScore > 0 ? `${b.score}/${b.maxScore}` : "splněno";
}

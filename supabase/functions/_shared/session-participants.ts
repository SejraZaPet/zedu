/**
 * Pure participant/slide success statistics for live sessions (no Deno imports,
 * shared by export-session-report, export-session-csv and vitest).
 * Success = correct / graded answers; slides without a correct answer are ignored.
 */
export interface StatResponse {
  player_id: string;
  question_index: number;
  is_correct: boolean;
  score?: number | null;
  response_time_ms?: number | null;
  answer?: any;
}
export interface StatPlayer { id: string; total_score?: number | null }

const UNGRADED = new Set([
  "poll", "wordcloud", "word_cloud", "wall", "open", "open_question", "open_answer",
  "brainstorm", "rating", "reflection", "scale", "discussion",
]);

export function slideActivityType(slide: any): string {
  return String(slide?.activitySpec?.activityType || slide?.activitySpec?.type || "").toLowerCase();
}

/** Slide has an evaluable correct answer. */
export function isGradedSlide(slide: any): boolean {
  if (!slide || slide.type !== "activity" || !slide.activitySpec) return false;
  const t = slideActivityType(slide);
  return !!t && !UNGRADED.has(t);
}

/** Rounded percent; null when there is nothing to divide. */
export function pct(correct: number, total: number): number | null {
  if (!Number.isFinite(total) || total <= 0) return null;
  return Math.round((Math.max(0, correct) / total) * 100);
}

export interface ParticipantStat {
  playerId: string;
  correct: number;
  graded: number;
  successRate: number | null;
  score: number;
  avgTimeMs: number | null;
}

export function computeParticipantStats(slides: any[], players: StatPlayer[], responses: StatResponse[]): ParticipantStat[] {
  const graded = new Set((slides || []).map((s, i) => (isGradedSlide(s) ? i : -1)).filter((i) => i >= 0));
  return (players || []).map((p) => {
    const mine = (responses || []).filter((r) => r.player_id === p.id);
    const g = mine.filter((r) => graded.has(r.question_index));
    const correct = g.filter((r) => r.is_correct).length;
    const times = mine.map((r) => Number(r.response_time_ms)).filter((n) => Number.isFinite(n) && n >= 0);
    return {
      playerId: p.id,
      correct,
      graded: g.length,
      successRate: pct(correct, g.length),
      score: Number(p.total_score) || 0,
      avgTimeMs: times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null,
    };
  });
}

/** Class average of participants who answered something graded, and how many are under 50 %. */
export function classSuccessSummary(stats: ParticipantStat[]) {
  const rated = stats.filter((s) => s.successRate !== null);
  const avg = rated.length ? Math.round(rated.reduce((a, s) => a + (s.successRate as number), 0) / rated.length) : null;
  return { averageSuccessRate: avg, needHelpCount: rated.filter((s) => (s.successRate as number) < 50).length, ratedCount: rated.length };
}

/** Option labels of a choice slide (current + legacy format). */
export function slideOptionLabels(slide: any): { label: string; correct: boolean }[] {
  const sp = slide?.activitySpec || {};
  if (Array.isArray(sp.options)) {
    return sp.options.map((o: any) => ({ label: String(typeof o === "string" ? o : o?.text ?? ""), correct: !!(o?.correct || o?.isCorrect) }));
  }
  if (Array.isArray(sp.model?.choices)) {
    return sp.model.choices.map((c: any, i: number) => ({ label: String(c), correct: i === sp.model.correctIndex }));
  }
  return [];
}

function selectedIndexes(answer: any): number[] {
  if (typeof answer === "number") return [answer];
  const v = answer?.selected ?? answer?.selectedIndex ?? answer?.index ?? answer?.choice;
  if (Array.isArray(v)) return v.filter((x) => Number.isInteger(x));
  return Number.isInteger(v) ? [v] : [];
}

/** How many participants picked each option; non-choice slides return []. */
export function answerDistribution(slide: any, responses: StatResponse[]): { label: string; correct: boolean; count: number }[] {
  const opts = slideOptionLabels(slide);
  if (!opts.length) return [];
  const counts = opts.map(() => 0);
  for (const r of responses || []) for (const i of selectedIndexes(r.answer)) if (i >= 0 && i < counts.length) counts[i]++;
  return opts.map((o, i) => ({ ...o, count: counts[i] }));
}

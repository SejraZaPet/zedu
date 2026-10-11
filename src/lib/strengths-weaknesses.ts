export interface LearnerSeries {
  learnerId: string;
  learnerName?: string;
  attempts: Array<{ correctRatio: number; order: number; completedAt?: string | null }>;
}

export interface StrengthWeaknessRow {
  key: string;
  label: string;
  assignmentId?: string;
  assignmentTitle?: string;
  firstPct: number | null;
  bestPct: number | null;
  learnerCount: number;
  repeaters: number;
  averageAttempts: number;
  failedLearners: string[];
  category: "strong" | "weak" | "other";
}

export function summarizePerformance(
  input: Omit<StrengthWeaknessRow, "firstPct" | "bestPct" | "learnerCount" | "repeaters" | "averageAttempts" | "failedLearners" | "category">,
  learners: LearnerSeries[],
): StrengthWeaknessRow {
  const usable = learners.filter((learner) => learner.attempts.length > 0);
  const first = usable.map((learner) => [...learner.attempts].sort((a, b) => a.order - b.order)[0].correctRatio);
  const best = usable.map((learner) => Math.max(...learner.attempts.map((attempt) => attempt.correctRatio)));
  const firstPct = first.length ? Math.round((first.reduce((sum, value) => sum + value, 0) / first.length) * 100) : null;
  const bestPct = best.length ? Math.round((best.reduce((sum, value) => sum + value, 0) / best.length) * 100) : null;
  const repeaters = usable.filter((learner) => learner.attempts.length > 1).length;
  const averageAttempts = usable.length
    ? Math.round((usable.reduce((sum, learner) => sum + learner.attempts.length, 0) / usable.length) * 10) / 10
    : 0;
  const failedLearners = usable
    .filter((learner) => Math.max(...learner.attempts.map((attempt) => attempt.correctRatio)) < 0.5)
    .map((learner) => learner.learnerName || learner.learnerId);
  return {
    ...input,
    firstPct,
    bestPct,
    learnerCount: usable.length,
    repeaters,
    averageAttempts,
    failedLearners,
    category: firstPct === null ? "other" : firstPct >= 75 ? "strong" : firstPct < 50 ? "weak" : "other",
  };
}

export function splitStrengthsWeaknesses(rows: StrengthWeaknessRow[]) {
  const repeatTie = (a: StrengthWeaknessRow, b: StrengthWeaknessRow) => b.repeaters - a.repeaters;
  return {
    strong: rows.filter((row) => row.category === "strong").sort((a, b) => (b.firstPct ?? 0) - (a.firstPct ?? 0) || repeatTie(a, b)),
    weak: rows.filter((row) => row.category === "weak").sort((a, b) => (a.firstPct ?? 0) - (b.firstPct ?? 0) || repeatTie(a, b)),
    other: rows.filter((row) => row.category === "other").sort((a, b) => (b.firstPct ?? -1) - (a.firstPct ?? -1) || repeatTie(a, b)),
  };
}
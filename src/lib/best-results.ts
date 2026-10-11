export interface ScoredResultRow {
  score: number | null;
  max_score: number | null;
}

export interface ActivityResultRow extends ScoredResultRow {
  activity_index: number;
  completed_at?: string | null;
}

export interface AttemptResultRow extends ScoredResultRow {
  status?: string | null;
  submitted_at?: string | null;
  attempt_number?: number | null;
}

export const resultRatio = (row: ScoredResultRow): number | null => {
  const max = Number(row.max_score) || 0;
  if (max <= 0) return null;
  return Math.min(1, Math.max(0, (Number(row.score) || 0) / max));
};

const timestamp = (value: string | null | undefined) => {
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
};

/** Vyšší poměr vyhrává; při shodě novější výsledek. */
export function betterScoredRow<T extends ScoredResultRow>(
  current: T | undefined,
  candidate: T,
  dateOf: (row: T) => string | null | undefined,
): T {
  if (!current) return candidate;
  const currentRatio = resultRatio(current) ?? -1;
  const candidateRatio = resultRatio(candidate) ?? -1;
  if (candidateRatio !== currentRatio) return candidateRatio > currentRatio ? candidate : current;
  return timestamp(dateOf(candidate)) >= timestamp(dateOf(current)) ? candidate : current;
}

/** Jeden nejlepší řádek pro každý activity_index. */
export function bestActivityResults<T extends ActivityResultRow>(rows: readonly T[]): Map<number, T> {
  const best = new Map<number, T>();
  for (const row of rows) {
    if (!Number.isInteger(row.activity_index)) continue;
    best.set(row.activity_index, betterScoredRow(best.get(row.activity_index), row, (r) => r.completed_at));
  }
  return best;
}

/** Nejlepší odevzdaný pokus; rozpracované pokusy se do skóre nepočítají. */
export function bestAttempt<T extends AttemptResultRow>(attempts: readonly T[]): T | null {
  let best: T | undefined;
  for (const attempt of attempts) {
    if (attempt.status !== "submitted") continue;
    best = betterScoredRow(best, attempt, (row) => row.submitted_at);
  }
  return best ?? null;
}

/** První výsledek aktivity podle completed_at. */
export function firstActivityResult<T extends ActivityResultRow>(rows: readonly T[]): T | null {
  return rows.reduce<T | null>((first, row) => {
    if (!first) return row;
    return timestamp(row.completed_at) < timestamp(first.completed_at) ? row : first;
  }, null);
}

/** První odevzdaný pokus podle attempt_number, při chybějícím čísle podle času. */
export function firstAttempt<T extends AttemptResultRow>(attempts: readonly T[]): T | null {
  const submitted = attempts.filter((attempt) => attempt.status === "submitted");
  if (submitted.length === 0) return null;
  return submitted.reduce((first, row) => {
    const firstNumber = Number(first.attempt_number);
    const rowNumber = Number(row.attempt_number);
    if (Number.isFinite(rowNumber) && (!Number.isFinite(firstNumber) || rowNumber < firstNumber)) return row;
    if (rowNumber === firstNumber && timestamp(row.submitted_at) < timestamp(first.submitted_at)) return row;
    return first;
  });
}

export function bestAttemptsBy<T extends AttemptResultRow>(
  attempts: readonly T[],
  keyOf: (attempt: T) => string,
): Map<string, T> {
  const grouped = new Map<string, T[]>();
  attempts.forEach((attempt) => grouped.set(keyOf(attempt), [...(grouped.get(keyOf(attempt)) ?? []), attempt]));
  const result = new Map<string, T>();
  grouped.forEach((rows, key) => {
    const best = bestAttempt(rows);
    if (best) result.set(key, best);
  });
  return result;
}
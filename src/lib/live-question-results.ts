export interface QuestionResponseResult { is_correct?: boolean | null; score?: number | null }

/** Skutečný podíl správných odpovědí; rychlostní skóre se do něj nezaměňuje. */
export function correctResponsePercent(responses: QuestionResponseResult[]): number {
  if (!responses.length) return 0;
  return Math.round((responses.filter((response) => response.is_correct).length / responses.length) * 100);
}

export function formatResponsePoints(score: number | null | undefined): string {
  return `${Math.round(Number(score) || 0)} b`;
}

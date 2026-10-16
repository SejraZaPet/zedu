export interface SortableParticipant { name: string; successRate: number | null; score: number }

/** Sorts participants; those with no graded answer ("–") always go last when sorting by success. */
export function sortParticipants<T extends SortableParticipant>(list: T[], key: "success" | "name" | "score"): T[] {
  const arr = [...(list || [])];
  if (key === "name") return arr.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  if (key === "score") return arr.sort((a, b) => b.score - a.score);
  return arr.sort((a, b) => (b.successRate ?? -1) - (a.successRate ?? -1) || b.score - a.score);
}

import { foldText } from "./lesson-picker-search";

export function matchesSearch(query: string, ...fields: (string | null | undefined)[]): boolean {
  const haystack = foldText(fields.filter(Boolean).join(" "));
  return foldText(query).split(/\s+/).filter(Boolean).every((word) => haystack.includes(word));
}

export const needsSearch = (count: number, growing = false): boolean => growing || count >= 8;
export const selectFound = (selected: string[], found: string[]): string[] => [...new Set([...selected, ...found])];
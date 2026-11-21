import { matchesSearch } from "@/lib/picker-search";

export type PresentationSource = "all" | "lesson" | "own";
export type PresentationUpdated = "all" | "today" | "7d" | "30d" | "older";
export type PresentationSort = "updated" | "title" | "created";
export const NO_SUBJECT = "__none";

export interface PresentationFilters {
  q: string; subject: string; source: PresentationSource; updated: PresentationUpdated; sort: PresentationSort;
}
export const DEFAULT_PRESENTATION_FILTERS: PresentationFilters = { q: "", subject: "all", source: "all", updated: "all", sort: "updated" };

export interface FilterablePresentation {
  title: string; lesson_id: string | null; source_lesson_id?: string | null;
  created_at: string; updated_at: string; lessonTitle?: string | null; subject?: string | null;
}

const DAY = 86_400_000;

export function presentationSource(p: FilterablePresentation): "lesson" | "own" {
  return p.lesson_id || p.source_lesson_id ? "lesson" : "own";
}

function updatedMatches(iso: string, f: PresentationUpdated, now: number): boolean {
  if (f === "all") return true;
  const t = new Date(iso).getTime();
  if (f === "today") { const d = new Date(now); d.setHours(0, 0, 0, 0); return t >= d.getTime(); }
  if (f === "7d") return now - t <= 7 * DAY;
  if (f === "30d") return now - t <= 30 * DAY;
  return now - t > 30 * DAY;
}

export function filterPresentations<T extends FilterablePresentation>(items: T[], f: PresentationFilters, now = Date.now()): T[] {
  const out = items.filter((p) => {
    if (f.q.trim() && !matchesSearch(f.q, p.title, p.lessonTitle)) return false;
    if (f.source !== "all" && presentationSource(p) !== f.source) return false;
    if (f.subject !== "all") {
      if (f.subject === NO_SUBJECT ? !!p.subject : p.subject !== f.subject) return false;
    }
    return updatedMatches(p.updated_at, f.updated, now);
  });
  const cmp: Record<PresentationSort, (a: T, b: T) => number> = {
    updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
    created: (a, b) => b.created_at.localeCompare(a.created_at),
    title: (a, b) => a.title.localeCompare(b.title, "cs"),
  };
  return [...out].sort(cmp[f.sort]);
}

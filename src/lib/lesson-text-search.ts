/**
 * Fulltextové hledání v obsahu lekcí na klientovi.
 * Prohledává název lekce a prostý text textových bloků.
 */

export interface SearchableLesson {
  id: string;
  title: string;
  blocks: any[] | null | undefined;
}

export interface LessonSearchHit {
  lessonId: string;
  title: string;
  /** Úryvek okolo shody (bez HTML), prázdný, když shoda byla jen v názvu. */
  snippet: string;
  matchedTitle: boolean;
}

const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

const SEARCHABLE_TYPES = new Set(["heading", "paragraph", "bullet_list", "callout", "summary", "quote"]);

/** Prostý text z textových bloků lekce (heading, paragraph, bullet_list, callout, summary, quote). */
export const lessonPlainText = (blocks: any[] | null | undefined): string => {
  if (!Array.isArray(blocks)) return "";
  const parts: string[] = [];
  const walk = (list: any[]) => {
    for (const b of list) {
      if (!b || b.visible === false) continue;
      if (b.type === "slide_group" && Array.isArray(b.props?.children)) {
        walk(b.props.children);
        continue;
      }
      if (!SEARCHABLE_TYPES.has(b.type)) continue;
      const p = b.props || {};
      if (typeof p.text === "string") parts.push(stripHtml(p.text));
      if (typeof p.title === "string") parts.push(stripHtml(p.title));
      if (typeof p.html === "string") parts.push(stripHtml(p.html));
      if (Array.isArray(p.items)) parts.push(p.items.map((i: any) => stripHtml(String(i ?? ""))).join(". "));
      if (typeof p.author === "string" && p.author) parts.push(p.author);
    }
  };
  walk(blocks);
  return parts.filter(Boolean).join(" ");
};

const fold = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Najde lekce, které obsahují hledaný výraz (bez ohledu na diakritiku a velikost písmen). */
export const searchLessons = (
  lessons: SearchableLesson[],
  query: string,
  snippetRadius = 60,
): LessonSearchHit[] => {
  const q = fold((query || "").trim());
  if (q.length < 2) return [];

  const hits: LessonSearchHit[] = [];
  for (const lesson of lessons) {
    const title = lesson.title || "";
    const matchedTitle = fold(title).includes(q);
    const text = lessonPlainText(lesson.blocks);
    const idx = fold(text).indexOf(q);
    if (!matchedTitle && idx < 0) continue;

    let snippet = "";
    if (idx >= 0) {
      const start = Math.max(0, idx - snippetRadius);
      const end = Math.min(text.length, idx + q.length + snippetRadius);
      snippet = `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
    }
    hits.push({ lessonId: lesson.id, title, snippet, matchedTitle });
  }
  return hits;
};

// Obsah sešitu — čisté pomocné funkce (bez závislostí na DB), testovatelné.

export interface TocPageLike {
  id: string;
  page_order: number;
  title?: string | null;
  section?: string | null;
}

export const NO_SECTION_LABEL = "Bez oddílu";

/** Zobrazovaný název stránky; prázdný název = „Strana N“ (N od 1). */
export function pageDisplayTitle(page: Pick<TocPageLike, "title">, index: number): string {
  const t = (page.title ?? "").trim();
  return t || `Strana ${index + 1}`;
}

export interface TocEntry<P extends TocPageLike = TocPageLike> {
  page: P;
  index: number; // pozice v sešitu (0-based)
  number: number; // číslo stránky (1-based)
  displayTitle: string;
}

export interface TocGroup<P extends TocPageLike = TocPageLike> {
  section: string | null;
  label: string;
  entries: TocEntry<P>[];
}

/** Seznam dosavadních oddílů (unikátní, v pořadí prvního výskytu). */
export function listSections(pages: TocPageLike[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of [...pages].sort((a, b) => a.page_order - b.page_order)) {
    const s = (p.section ?? "").trim();
    if (s && !seen.has(s.toLowerCase())) { seen.add(s.toLowerCase()); out.push(s); }
  }
  return out;
}

/**
 * Seskupí stránky podle oddílu. Oddíly v pořadí prvního výskytu,
 * stránky uvnitř podle page_order, „Bez oddílu“ vždy na konci.
 * `query` filtruje podle názvu (včetně „Strana N“) a oddílu, bez ohledu na diakritiku/velikost.
 */
export function buildToc<P extends TocPageLike>(pages: P[], query = ""): TocGroup<P>[] {
  const sorted = [...pages].sort((a, b) => a.page_order - b.page_order);
  const q = norm(query);
  const groups = new Map<string, TocGroup<P>>();
  const none: TocGroup<P> = { section: null, label: NO_SECTION_LABEL, entries: [] };
  sorted.forEach((page, index) => {
    const displayTitle = pageDisplayTitle(page, index);
    const section = (page.section ?? "").trim();
    if (q && !norm(displayTitle).includes(q) && !norm(section).includes(q)) return;
    const entry: TocEntry<P> = { page, index, number: index + 1, displayTitle };
    if (!section) { none.entries.push(entry); return; }
    const key = section.toLowerCase();
    if (!groups.has(key)) groups.set(key, { section, label: section, entries: [] });
    groups.get(key)!.entries.push(entry);
  });
  const result = Array.from(groups.values());
  if (none.entries.length) result.push(none);
  return result;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

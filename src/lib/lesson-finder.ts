/**
 * Čisté hledání, filtry, počty a řazení pro sdílený výběr lekcí (LessonFinder).
 * Pracuje jen s položkami, které volající už smí vidět – nic nepřidává, jen zužuje.
 */
import { foldText } from "./lesson-picker-search";

export interface FinderItem {
  id: string;
  title: string;
  textbookId?: string | null;
  textbookTitle?: string | null;
  subject?: string | null;
  topic?: string | null;
  /** ISO datum poslední úpravy (pokud je k dispozici). */
  updatedAt?: string | null;
  sortOrder?: number | null;
  /** Doplňkový text do výsledku (např. „ukázka“, druh materiálu). */
  note?: string | null;
}
export type FinderSort = "recent" | "az" | "book";
export interface FinderFilters { query: string; subject: string; book: string; topic: string }
export const EMPTY_FILTERS: FinderFilters = { query: "", subject: "", book: "", topic: "" };
export const NO_SUBJECT = "__none";
export const PAGE_SIZE = 50;

/** Předměty bývají uložené jako název i jako kód („medialni_vychova“) – sjednotit. */
export const subjectKey = (s?: string | null): string =>
  s ? foldText(s).replace(/[_\s]+/g, " ").trim() : "";
export function subjectLabel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/** Delší slovo bez koncové samohlásky, aby „příprava“ našla i „přípravě“ (české skloňování). */
export function wordStem(w: string): string {
  return w.length >= 5 ? w.replace(/[aeiouy]$/, "") : w;
}

export function matchesQuery(item: FinderItem, query: string): boolean {
  const words = foldText(query).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = foldText([item.title, item.textbookTitle, item.subject?.replace(/_/g, " "), item.topic, item.note].filter(Boolean).join(" "));
  return words.every((w) => hay.includes(wordStem(w)));
}

function passes(item: FinderItem, f: FinderFilters, skip?: keyof FinderFilters): boolean {
  if (skip !== "query" && !matchesQuery(item, f.query)) return false;
  if (skip !== "subject" && f.subject) {
    const k = subjectKey(item.subject);
    if (f.subject === NO_SUBJECT ? !!k : k !== f.subject) return false;
  }
  if (skip !== "book" && f.book && (item.textbookId ?? "") !== f.book) return false;
  if (skip !== "topic" && f.topic && (item.topic ?? "") !== f.topic) return false;
  return true;
}

export function filterFinderItems<T extends FinderItem>(items: T[], f: FinderFilters): T[] {
  return items.filter((i) => passes(i, f));
}

export interface Facet { value: string; label: string; count: number }
/** Možnosti filtru s počty podle ostatních aktivních filtrů (kombinovatelné). */
export function facetOptions(items: FinderItem[], f: FinderFilters, key: "subject" | "book" | "topic", subjectNames?: Map<string, string>): Facet[] {
  const map = new Map<string, Facet>();
  for (const i of items) {
    if (!passes(i, f, key)) continue;
    let value: string; let label: string;
    if (key === "subject") { value = subjectKey(i.subject) || NO_SUBJECT; label = i.subject ? subjectNames?.get(value) ?? subjectLabel(i.subject) : "Bez předmětu"; }
    else if (key === "book") { if (!i.textbookId) continue; value = i.textbookId; label = i.textbookTitle || "Učebnice"; }
    else { if (!i.topic) continue; value = i.topic; label = i.topic; }
    const cur = map.get(value);
    if (cur) cur.count++;
    else map.set(value, { value, label, count: 1 });
  }
  return [...map.values()].sort((a, b) =>
    a.value === NO_SUBJECT ? 1 : b.value === NO_SUBJECT ? -1 : a.label.localeCompare(b.label, "cs"));
}

export const hasActiveFilters = (f: FinderFilters) => !!(f.query.trim() || f.subject || f.book || f.topic);
export const defaultSort = (items: FinderItem[]): FinderSort => (items.some((i) => i.updatedAt) ? "recent" : "book");

export function sortFinderItems<T extends FinderItem>(items: T[], sort: FinderSort): T[] {
  const byBook = (a: T, b: T) => (a.textbookTitle ?? "").localeCompare(b.textbookTitle ?? "", "cs")
    || (a.textbookId ?? "").localeCompare(b.textbookId ?? "")
    || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  const az = (a: T, b: T) => a.title.localeCompare(b.title, "cs");
  return [...items].sort((a, b) => {
    let r = 0;
    if (sort === "recent") r = (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "") || byBook(a, b);
    else if (sort === "az") r = az(a, b) || byBook(a, b);
    else r = byBook(a, b) || az(a, b);
    return r || a.id.localeCompare(b.id);
  });
}

/** Rozdělí text na části se zvýrazněním shod (bez ohledu na diakritiku). */
export function highlightParts(text: string, query: string): { text: string; hit: boolean }[] {
  const words = foldText(query).split(/\s+/).filter(Boolean).map(wordStem);
  if (!words.length || !text) return [{ text, hit: false }];
  const chars = [...text];
  const folded = chars.map((c) => foldText(c) || c.toLowerCase());
  const flat = folded.join("");
  const owner: number[] = [];
  folded.forEach((f, i) => { for (let k = 0; k < f.length; k++) owner.push(i); });
  const hit = new Array(chars.length).fill(false);
  for (const w of words) {
    for (let at = flat.indexOf(w); at >= 0; at = flat.indexOf(w, at + 1)) {
      for (let k = at; k < at + w.length; k++) hit[owner[k]] = true;
    }
  }
  const out: { text: string; hit: boolean }[] = [];
  chars.forEach((c, i) => {
    const last = out[out.length - 1];
    if (last && last.hit === hit[i]) last.text += c; else out.push({ text: c, hit: hit[i] });
  });
  return out;
}

export function resultsAnnouncement(shown: number, total: number): string {
  if (total === 0) return "Nic nenalezeno.";
  const word = total === 1 ? "lekce" : total < 5 ? "lekce" : "lekcí";
  return shown < total ? `Nalezeno ${total} ${word}, zobrazeno ${shown}.` : `Nalezeno ${total} ${word}.`;
}

import { Fragment, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { Search, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { fetchSubjectCatalog } from "@/lib/subjects-catalog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  EMPTY_FILTERS, PAGE_SIZE, defaultSort, facetOptions, filterFinderItems, hasActiveFilters,
  highlightParts, resultsAnnouncement, sortFinderItems, subjectKey, type FinderFilters, type FinderItem, type FinderSort,
} from "@/lib/lesson-finder";

const ALL = "__all";
export interface LessonFinderState { filters: FinderFilters; sort: FinderSort | null }
export const EMPTY_FINDER_STATE: LessonFinderState = { filters: EMPTY_FILTERS, sort: null };

function Highlight({ text, query }: { text: string; query: string }) {
  return <>{highlightParts(text, query).map((p, i) => p.hit
    ? <mark key={i} className="rounded-sm bg-primary/20 text-foreground">{p.text}</mark>
    : <Fragment key={i}>{p.text}</Fragment>)}</>;
}

/**
 * Sdílený výběr lekce: hledání bez diakritiky, kombinovatelné filtry s počty,
 * řazení, postupné zobrazování (nic se tiše neusekne) a prázdný stav.
 * Filtry žijí jen v komponentě – po zavření okna se zapomenou.
 */
export default function LessonFinder<T extends FinderItem>({
  items, selectedId, onSelect, label = "Vybrat lekci", disabled, renderMeta, emptyText = "Zatím tu nejsou žádné lekce.", state, onStateChange,
}: {
  items: T[];
  selectedId?: string;
  onSelect: (item: T) => void;
  label?: string;
  disabled?: boolean;
  renderMeta?: (item: T) => ReactNode;
  emptyText?: string;
  /** Volitelně řízený stav filtrů – volající ho drží po dobu otevřeného okna, když se výběr skrývá a znovu ukazuje. */
  state?: LessonFinderState;
  onStateChange?: (s: LessonFinderState) => void;
}) {
  const uid = useId();
  const [localState, setLocalState] = useState<LessonFinderState>(state ?? EMPTY_FINDER_STATE);
  const current = state ?? localState;
  const update = (next: LessonFinderState) => { setLocalState(next); onStateChange?.(next); };
  const filters = current.filters;
  const sort = current.sort;
  const setFilters = (next: FinderFilters | ((f: FinderFilters) => FinderFilters)) =>
    update({ ...current, filters: typeof next === "function" ? next(current.filters) : next });
  const setSort = (v: FinderSort) => update({ ...current, sort: v });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const effectiveSort = sort ?? defaultSort(items);
  const set = (patch: Partial<FinderFilters>) => { setFilters({ ...filters, ...patch }); setLimit(PAGE_SIZE); };

  const [subjectNames, setSubjectNames] = useState<Map<string, string>>();
  useEffect(() => {
    let alive = true;
    // Jen české názvy pro popisky filtru; při chybě zůstane převod z kódu.
    fetchSubjectCatalog().then((rows) => { if (alive) setSubjectNames(new Map(rows.map((r) => [subjectKey(r.name), r.name]))); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const subjects = useMemo(() => facetOptions(items, filters, "subject", subjectNames), [items, filters, subjectNames]);
  const books = useMemo(() => facetOptions(items, filters, "book"), [items, filters]);
  const topics = useMemo(() => facetOptions(items, filters, "topic"), [items, filters]);
  const found = useMemo(() => sortFinderItems(filterFinderItems(items, filters), effectiveSort), [items, filters, effectiveSort]);
  const shown = found.slice(0, limit);
  const active = hasActiveFilters(filters);
  const [announce, setAnnounce] = useState("");
  useEffect(() => { const t = setTimeout(() => setAnnounce(resultsAnnouncement(shown.length, found.length)), 300); return () => clearTimeout(t); }, [shown.length, found.length]);

  if (!items.length) return <p className="text-sm text-muted-foreground">{emptyText}</p>;

  const facetSelect = (key: "subject" | "book" | "topic", title: string, all: string, opts: typeof subjects) =>
    (opts.length > 1 || filters[key]) && (
      <Select value={filters[key] || ALL} disabled={disabled} onValueChange={(v) => set({ [key]: v === ALL ? "" : v } as Partial<FinderFilters>)}>
        <SelectTrigger aria-label={title} className="min-h-11 min-w-0"><SelectValue placeholder={all} /></SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value={ALL}>{all}</SelectItem>
          {opts.map((o) => <SelectItem key={o.value} value={o.value}>{o.label} ({o.count})</SelectItem>)}
        </SelectContent>
      </Select>
    );

  return (
    <div className="space-y-2 min-w-0" role="group" aria-labelledby={`${uid}-label`}>
      <p id={`${uid}-label`} className="text-sm font-medium">{label}</p>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" value={filters.query} disabled={disabled} onChange={(e) => set({ query: e.target.value })}
          aria-label="Hledat lekci podle názvu, učebnice, předmětu nebo tématu" aria-controls={`${uid}-list`}
          placeholder="Hledat lekci, učebnici, předmět…" className="min-h-11 pl-9" />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {facetSelect("subject", "Filtr předmětu", "Všechny předměty", subjects)}
        {facetSelect("book", "Filtr učebnice", "Všechny učebnice", books)}
        {facetSelect("topic", "Filtr tématu", "Všechna témata", topics)}
        <Select value={effectiveSort} disabled={disabled} onValueChange={(v) => setSort(v as FinderSort)}>
          <SelectTrigger aria-label="Řazení" className="min-h-11 min-w-0"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Nejnovější úpravy</SelectItem>
            <SelectItem value="az">Název A–Z</SelectItem>
            <SelectItem value="book">Podle učebnice a pořadí</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Nalezeno {found.length} z {items.length}</p>
        {active && <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={() => { setFilters(EMPTY_FILTERS); setLimit(PAGE_SIZE); }}>
          <X className="mr-1 h-4 w-4" aria-hidden />Zrušit filtry</Button>}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{announce}</p>
      {found.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-4 text-sm">
          <p className="break-words">Nic nenalezeno{filters.query.trim() ? <> pro hledání „{filters.query.trim()}“</> : " pro zvolené filtry"}.</p>
          <Button type="button" variant="outline" size="sm" className="mt-2 min-h-11" onClick={() => setFilters(EMPTY_FILTERS)}>Zrušit filtry</Button>
        </div>
      ) : (
        <ul id={`${uid}-list`} className="max-h-[50dvh] space-y-1 overflow-y-auto overflow-x-hidden rounded-md border border-border p-1" aria-label="Výsledky">
          {shown.map((item) => {
            const sel = item.id === selectedId;
            return (
              <li key={item.id}>
                <button type="button" disabled={disabled} aria-pressed={sel} onClick={() => onSelect(item)}
                  className={`flex min-h-11 w-full items-start gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 ${sel ? "bg-primary/10" : ""}`}>
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${sel ? "text-primary" : "invisible"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-medium"><Highlight text={item.title} query={filters.query} /></span>
                    <span className="block break-words text-xs text-muted-foreground">
                      {renderMeta ? renderMeta(item) : <Highlight text={[item.textbookTitle, item.topic, item.note].filter(Boolean).join(" · ")} query={filters.query} />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {shown.length < found.length && (
            <li className="p-1">
              <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setLimit((n) => n + PAGE_SIZE)}>
                Zobrazit další ({found.length - shown.length})
              </Button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

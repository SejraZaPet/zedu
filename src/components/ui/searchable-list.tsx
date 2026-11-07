import { Button } from "./button";
import { SearchField, SearchEmpty } from "./search-field";
import { selectFound } from "@/lib/picker-search";
import type { ReactNode } from "react";

export function SearchableList({ query, onQueryChange, count, label, foundIds, selected, onSelectionChange, children }: {
  query: string; onQueryChange: (q: string) => void; count: number; label: string;
  foundIds?: string[]; selected?: string[]; onSelectionChange?: (ids: string[]) => void; children: ReactNode;
}) {
  return <div className="min-w-0 space-y-2">
    <SearchField value={query} onChange={onQueryChange} label={label} count={count} />
    {onSelectionChange && selected && foundIds && <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="ghost" className="min-h-11 whitespace-normal" disabled={!foundIds.length}
        onClick={() => onSelectionChange(selectFound(selected, foundIds))}>Vybrat vše z nalezených</Button>
      <span className="text-xs text-muted-foreground">Vybráno {selected.length}</span>
    </div>}
    {count === 0 ? <SearchEmpty onClear={() => onQueryChange("")} /> : children}
  </div>;
}
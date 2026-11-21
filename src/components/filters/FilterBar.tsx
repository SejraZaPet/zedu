import { useState, type ReactNode } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchField } from "@/components/ui/search-field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterDef {
  id: string; label: string; value: string; defaultValue: string;
  options: { value: string; label: string }[]; onChange: (v: string) => void;
  /** Řazení se nepočítá jako aktivní filtr. */
  chip?: boolean;
}

export function FilterBar({ search, onSearch, searchLabel = "Hledat", filters, shown, total, onClear, extra }: {
  search: string; onSearch: (v: string) => void; searchLabel?: string; filters: FilterDef[];
  shown: number; total: number; onClear: () => void; extra?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = filters.filter((f) => f.chip !== false && f.value !== f.defaultValue);
  const anyActive = active.length > 0 || search.trim() !== "";
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-[200px] flex-1"><SearchField value={search} onChange={onSearch} label={searchLabel} /></div>
        <Button type="button" variant="outline" className="h-11 gap-1 md:hidden" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <SlidersHorizontal className="h-4 w-4" /> Filtry{active.length ? ` (${active.length})` : ""}
        </Button>
        <div className={`${open ? "flex" : "hidden"} w-full flex-wrap gap-2 md:flex md:w-auto`}>
          {filters.map((f) => (
            <Select key={f.id} value={f.value} onValueChange={f.onChange}>
              <SelectTrigger className="h-11 w-full sm:w-44" aria-label={f.label}><SelectValue /></SelectTrigger>
              <SelectContent>
                {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          {extra}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {anyActive ? `${shown} z ${total}` : `${total} celkem`}
        </p>
        {active.map((f) => (
          <Button key={f.id} type="button" size="sm" variant="secondary" className="h-8 gap-1 rounded-full"
            aria-label={`Zrušit filtr ${f.label}`} onClick={() => f.onChange(f.defaultValue)}>
            {f.label}: {f.options.find((o) => o.value === f.value)?.label ?? f.value} <X className="h-3 w-3" />
          </Button>
        ))}
        {anyActive && <Button type="button" size="sm" variant="ghost" className="h-8" onClick={onClear}>Vymazat filtry</Button>}
      </div>
    </div>
  );
}

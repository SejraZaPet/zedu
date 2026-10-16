import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { filterByTitle, togglePicked } from "@/lib/lesson-picker-search";

interface Item { id: string; title: string }

interface Props {
  items: Item[];
  /** multi = zaškrtávací políčka, single = výběr jedné položky */
  mode: "multi" | "single";
  selected: string[];
  onChange: (ids: string[]) => void;
  label: string;
  searchPlaceholder: string;
  /** Zobrazit hledání jen pokud je položek víc než tolik. */
  searchFrom?: number;
  showCount?: boolean;
}

export default function SearchablePickList({
  items, mode, selected, onChange, label, searchPlaceholder, searchFrom = 0, showCount,
}: Props) {
  const [q, setQ] = useState("");
  const visible = useMemo(() => filterByTitle(items, q), [items, q]);
  const withSearch = items.length > searchFrom;
  return (
    <fieldset className="space-y-2 border rounded-lg p-3">
      <legend className="text-sm font-medium px-1">{label}</legend>
      {withSearch && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={searchPlaceholder} aria-label={searchPlaceholder} className="pl-8" />
        </div>
      )}
      <div className="max-h-56 overflow-y-auto space-y-1" role={mode === "single" ? "radiogroup" : undefined}>
        {visible.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">Nic nenalezeno</p>
        ) : visible.map((it) => mode === "multi" ? (
          <label key={it.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
            <Checkbox checked={selected.includes(it.id)}
              onCheckedChange={(v) => onChange(togglePicked(selected, it.id, !!v))} />
            {it.title}
          </label>
        ) : (
          <label key={it.id} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
            <input type="radio" name={label} className="accent-primary" checked={selected[0] === it.id}
              onChange={() => onChange([it.id])} />
            {it.title}
          </label>
        ))}
      </div>
      {showCount && <p className="text-xs text-muted-foreground">Vybráno: {selected.length}</p>}
    </fieldset>
  );
}

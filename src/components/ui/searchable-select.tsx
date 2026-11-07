import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandInput, CommandList, CommandItem } from "./command";
import { SearchEmpty } from "./search-field";
import { matchesSearch, needsSearch } from "@/lib/picker-search";

export interface SearchOption { value: string; label: string; subtitle?: string; disabled?: boolean }
export function SearchableSelect({ value, onValueChange, options, placeholder = "Vyberte…", label = "Hledat", growing = false, disabled = false, id }: {
  value: string; onValueChange: (value: string) => void; options: SearchOption[]; placeholder?: string; label?: string; growing?: boolean; disabled?: boolean; id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const visible = options.filter((o) => matchesSearch(query, o.label, o.subtitle));
  const selected = options.find((o) => o.value === value);
  return <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery(""); }}>
    <PopoverTrigger asChild><Button id={id} type="button" variant="outline" disabled={disabled} role="combobox" aria-label={label} aria-expanded={open}
      className="h-auto min-h-11 w-full min-w-0 justify-between whitespace-normal text-left font-normal">
      <span className="min-w-0 break-words">{selected?.label || placeholder}</span><ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
    </Button></PopoverTrigger>
    <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
      <Command shouldFilter={false}>
        {needsSearch(options.length, growing) && <CommandInput value={query} onValueChange={setQuery} placeholder={`${label}…`} aria-label={label} />}
        <CommandList>
          {visible.length === 0 && <SearchEmpty onClear={() => setQuery("")} />}
          {visible.map((o) => <CommandItem key={o.value} value={o.value} disabled={o.disabled} className="min-h-11 gap-2 whitespace-normal"
            onSelect={() => { onValueChange(o.value); setOpen(false); setQuery(""); }}>
            <Check aria-hidden className={`h-4 w-4 shrink-0 ${value === o.value ? "opacity-100" : "opacity-0"}`} />
            <span className="min-w-0 break-words">{o.label}{o.subtitle && <span className="block text-xs text-muted-foreground">{o.subtitle}</span>}</span>
          </CommandItem>)}
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>;
}
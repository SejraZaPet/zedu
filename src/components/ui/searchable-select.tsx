import { useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Command, CommandGroup, CommandInput, CommandList, CommandItem } from "./command";
import { SearchEmpty } from "./search-field";
import { Skeleton } from "./skeleton";
import { matchesSearch, needsSearch } from "@/lib/picker-search";
import { usePopoverListPlacement } from "@/hooks/usePopoverListPlacement";

export interface SearchOption {
  value: string;
  label: string;
  subtitle?: string;
  disabled?: boolean;
  group?: string;
  /** Zůstane viditelná i při hledání; vhodné pro „Bez konkrétní volby“. */
  pinned?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchOption[];
  placeholder?: string;
  label?: string;
  triggerLabel?: string;
  growing?: boolean;
  disabled?: boolean;
  id?: string;
  loading?: boolean;
  loadingLabel?: string;
  error?: string | null;
  retrying?: boolean;
  onRetry?: () => void;
  emptyMessage?: string;
  searchPlaceholder?: string;
  emptySearchMessage?: string;
  showSelectedSubtitle?: boolean;
}

export function SearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Vyberte…",
  label = "Hledat",
  triggerLabel,
  growing = false,
  disabled = false,
  id,
  loading = false,
  loadingLabel = "Načítám…",
  error = null,
  retrying = false,
  onRetry,
  emptyMessage,
  searchPlaceholder,
  emptySearchMessage,
  showSelectedSubtitle = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listPlacement = usePopoverListPlacement(open, triggerRef, 82);
  const hasQuery = Boolean(query.trim());
  const matchCount = options.filter((o) => matchesSearch(query, o.label, o.subtitle, o.group)).length;
  const visible = options.filter((o) => o.pinned || matchesSearch(query, o.label, o.subtitle, o.group));
  const selected = options.find((o) => o.value === value);
  const groups = new Map<string, SearchOption[]>();
  for (const option of visible) {
    if (!option.group) continue;
    groups.set(option.group, [...(groups.get(option.group) ?? []), option]);
  }
  const showSearchEmpty = (hasQuery && matchCount === 0) || visible.length === 0;
  const close = () => { setOpen(false); setQuery(""); };
  const renderOption = (o: SearchOption) => (
    <CommandItem key={o.value} value={o.value} disabled={o.disabled} className="min-h-11 gap-2 whitespace-normal px-3 py-2"
      onSelect={() => { onValueChange(o.value); close(); }}>
      <Check aria-hidden className={`h-4 w-4 shrink-0 ${value === o.value ? "opacity-100" : "opacity-0"}`} />
      <span className="min-w-0 break-words">{o.label}{o.subtitle && <span className="block text-xs text-muted-foreground">{o.subtitle}</span>}</span>
    </CommandItem>
  );

  if (loading) {
    return <div className="mt-1 space-y-2" role="status" aria-live="polite">
      <Skeleton data-testid="searchable-select-loading" className="h-11 w-full" />
      <p className="text-xs text-muted-foreground">{loadingLabel}</p>
    </div>;
  }

  if (error) {
    return <div className="mt-1 space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
      <p className="text-sm font-medium text-foreground">{error}</p>
      {onRetry && <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={retrying} onClick={onRetry}>
        {retrying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        Zkusit znovu
      </Button>}
    </div>;
  }

  return <>
    <Popover modal open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild><Button ref={triggerRef} id={id} type="button" variant="outline" disabled={disabled} role="combobox" aria-label={triggerLabel ?? label} aria-expanded={open}
        className="h-auto min-h-11 w-full min-w-0 justify-between whitespace-normal text-left font-normal">
        <span className="min-w-0 break-words">{selected?.label || placeholder}{showSelectedSubtitle && selected?.subtitle && <span className="block text-xs text-muted-foreground">{selected.subtitle}</span>}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </Button></PopoverTrigger>
      <PopoverContent align="start" side={listPlacement.side} collisionPadding={8} className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] p-0">
        <Command shouldFilter={false} label={label}>
          {needsSearch(options.length, growing) && <>
            <div className="flex min-w-0 items-center">
              <div className="min-w-0 flex-1"><CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={searchPlaceholder ?? `${label}…`} aria-label={label} /></div>
              {query && <Button type="button" variant="ghost" className="h-11 w-11 shrink-0" aria-label="Vymazat hledání" onClick={() => setQuery("")}>×</Button>}
            </div>
            <p role="status" className="px-3 py-1 text-xs text-muted-foreground">Nalezeno {hasQuery ? matchCount : visible.length}</p>
          </>}
          <CommandList className="overscroll-contain" style={{ maxHeight: listPlacement.maxHeight }}>
            {showSearchEmpty && (emptySearchMessage ? <div className="p-3 text-center text-sm text-muted-foreground" role="status">
              <p>{emptySearchMessage}</p><Button type="button" variant="ghost" className="min-h-11" onClick={() => setQuery("")}>Vymazat hledání</Button>
            </div> : <SearchEmpty onClear={() => setQuery("")} />)}
            {visible.filter((option) => !option.group).map(renderOption)}
            {[...groups.entries()].map(([group, groupOptions]) => <CommandGroup key={group} heading={group}>
              {groupOptions.map(renderOption)}
            </CommandGroup>)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    {emptyMessage && options.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{emptyMessage}</p>}
  </>;
}

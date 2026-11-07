import { useId, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "./input";
import { Button } from "./button";

export function SearchField({ value, onChange, label = "Hledat", count }: {
  value: string; onChange: (value: string) => void; label?: string; count?: number;
}) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  return <div className="min-w-0 space-y-1">
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input ref={ref} id={id} aria-label={label} placeholder={`${label}…`} value={value}
        className="h-11 w-full min-w-0 pl-9 pr-12" onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Escape" && value) { e.preventDefault(); e.stopPropagation(); onChange(""); } }} />
      {value && <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-11 w-11" aria-label="Vymazat hledání"
        onClick={() => { onChange(""); ref.current?.focus(); }}><X className="h-4 w-4" /></Button>}
    </div>
    {count !== undefined && <p className="text-xs text-muted-foreground" role="status">Nalezeno {count}</p>}
  </div>;
}

export function SearchEmpty({ onClear }: { onClear: () => void }) {
  return <div className="p-3 text-center text-sm text-muted-foreground" role="status">
    <p>Nic nenalezeno</p><Button type="button" variant="ghost" className="min-h-11" onClick={onClear}>Vymazat hledání</Button>
  </div>;
}
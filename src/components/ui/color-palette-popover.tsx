import { useState } from "react";
import { X } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { COLOR_GROUPS } from "@/lib/color-palette";

interface Props {
  /** Aktuálně zvolená barva (hex) nebo `null` pro výchozí. */
  value: string | null;
  /** `null` = zrušit / výchozí barva. */
  onChange: (value: string | null) => void;
  /** Popisek volby „bez barvy“. */
  clearLabel?: string;
  /** Spouštěč popoveru (tlačítko v liště). */
  trigger: React.ReactNode;
  align?: "start" | "center" | "end";
}

/**
 * Jediná komponenta pro výběr barvy v appce – kategorie
 * Neutrální / Hlavní / Světlé + vlastní hex.
 */
const ColorPalettePopover = ({
  value,
  onChange,
  clearLabel = "Výchozí barva",
  trigger,
  align = "start",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [customColor, setCustomColor] = useState(
    /^#[0-9a-fA-F]{6}$/.test(value || "") ? (value as string) : "#000000",
  );

  const apply = (val: string | null) => {
    onChange(val);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-[220px] space-y-2 p-3">
        <button
          type="button"
          onClick={() => apply(null)}
          className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-muted"
        >
          <X className="h-3 w-3" />
          <span>{clearLabel}</span>
        </button>

        {COLOR_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {group.colors.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  aria-label={c.name}
                  onClick={() => apply(c.value)}
                  className={`h-6 w-6 rounded border transition-all hover:scale-110 ${
                    value === c.value
                      ? "ring-2 ring-primary ring-offset-1 ring-offset-background"
                      : "border-border"
                  }`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
          </div>
        ))}

        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Vlastní barva
          </p>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
              aria-label="Vlastní barva"
            />
            <span className="font-mono text-xs text-muted-foreground">{customColor}</span>
            <button
              type="button"
              onClick={() => apply(customColor)}
              className="ml-auto rounded bg-primary px-2 py-0.5 text-xs text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Použít
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColorPalettePopover;

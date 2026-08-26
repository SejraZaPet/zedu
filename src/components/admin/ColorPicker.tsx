import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { SLIDE_TEXT_COLORS } from "@/lib/slide-typography";

interface Props {
  value: string | null | undefined;
  onChange: (v: string | null) => void;
  /** Povolit „bez barvy“ / návrat na výchozí. */
  allowNull?: boolean;
  nullLabel?: string;
  swatches?: string[];
  /** Kompaktní varianta (menší swatche) – např. do plovoucí lišty. */
  compact?: boolean;
  className?: string;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** #abc -> #aabbcc, aby native color input i uložená hodnota byly konzistentní. */
const expandHex = (v: string) =>
  v.length === 4 ? `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}` : v;

/**
 * Sdílený výběr barvy: paleta swatchů + nativní color input + textový HEX.
 * HEX se validuje při blur (nebo Enter); nevalidní hodnota se ignoruje.
 */
export const ColorPicker = ({
  value,
  onChange,
  allowNull,
  nullLabel = "Bez barvy",
  swatches = SLIDE_TEXT_COLORS,
  compact,
  className,
}: Props) => {
  const [hex, setHex] = useState(value && HEX_RE.test(value) ? value : "");

  useEffect(() => {
    setHex(value && HEX_RE.test(value) ? value : "");
  }, [value]);

  const commitHex = () => {
    const v = hex.trim();
    if (HEX_RE.test(v)) {
      onChange(v);
      return;
    }
    // Nevalidní vstup ignorujeme a vrátíme zobrazení na aktuální barvu.
    setHex(value && HEX_RE.test(value) ? value : "");
  };

  const dot = compact ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {allowNull && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className={`rounded border px-1.5 text-[10px] ${compact ? "h-5" : "h-6"} ${
              !value ? "border-primary text-foreground" : "border-border text-muted-foreground"
            }`}
          >
            {nullLabel}
          </button>
        )}
        {swatches.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`Barva ${c}`}
            onClick={() => onChange(c)}
            className={`${dot} rounded-full border-2 transition-transform ${
              value?.toLowerCase() === c.toLowerCase() ? "border-primary scale-110" : "border-border"
            }`}
            style={{ background: c }}
          />
        ))}
        <input
          type="color"
          value={value && HEX_RE.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Vlastní barva"
          title="Vlastní barva"
          className={`${compact ? "h-5 w-7" : "h-6 w-9"} cursor-pointer rounded border border-border bg-transparent p-0.5`}
        />
      </div>
      <Input
        value={hex}
        onChange={(e) => setHex(e.target.value)}
        onBlur={commitHex}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitHex();
          }
        }}
        placeholder="#f5f6fa"
        aria-label="HEX kód barvy"
        className="h-7 w-[110px] font-mono text-xs"
      />
    </div>
  );
};

export default ColorPicker;

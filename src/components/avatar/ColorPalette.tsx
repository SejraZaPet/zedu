import { useId, useRef } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { BRAND_GRADIENT_CSS, isGradientValue } from "@/lib/avatar-palettes";

interface Props {
  value: string | null;
  onChange: (hex: string | null) => void;
  swatches: string[];
  label?: string;
  allowClear?: boolean;
  allowCustom?: boolean;
  className?: string;
}

/** Normalize hex-only values. Special sentinel values (e.g. "gradient:brand") pass through untouched. */
function normalize(hex: string | null | undefined): string | null {
  if (!hex) return null;
  if (isGradientValue(hex)) return hex;
  const m = hex.trim().match(/^#?([0-9a-f]{6})$/i);
  return m ? `#${m[1].toLowerCase()}` : null;
}

function swatchBackground(v: string): string {
  return isGradientValue(v) ? BRAND_GRADIENT_CSS : v;
}

/**
 * Circular color swatches + native color picker for a custom color.
 * Used inside each tintable category panel in AvatarEditor.
 */
export default function ColorPalette({
  value,
  onChange,
  swatches,
  label = "Barva",
  allowClear = true,
  allowCustom = true,
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const labelId = useId();
  const currentNormalized = normalize(value);
  const isCustom =
    !!currentNormalized &&
    !isGradientValue(currentNormalized) &&
    !swatches.some((s) => normalize(s) === currentNormalized);

  return (
    <div className={cn("rounded-lg border bg-card p-3", className)}>
      <div className="flex items-center justify-between mb-2">
        <span id={labelId} className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {allowClear && currentNormalized && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded px-1 py-0.5"
            aria-label="Zrušit barvu"
          >
            <X className="w-3 h-3" /> Bez barvy
          </button>
        )}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-2 items-center"
      >
        {swatches.map((hex) => {
          const n = normalize(hex);
          const selected = n === currentNormalized;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={isGradientValue(hex) ? "Brand gradient" : `Barva ${hex}`}
              onClick={() => onChange(n)}
              className={cn(
                "relative w-8 h-8 rounded-full border-2 transition-transform",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                selected
                  ? "border-primary scale-110 ring-2 ring-primary/30"
                  : "border-border hover:scale-105",
              )}
              style={{ background: swatchBackground(hex) }}
            />
          );
        })}
        {allowCustom && (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className={cn(
                "relative w-8 h-8 rounded-full border-2 flex items-center justify-center overflow-hidden",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                isCustom
                  ? "border-primary scale-110 ring-2 ring-primary/30"
                  : "border-border hover:scale-105",
              )}
              aria-label="Vlastní barva"
              style={
                isCustom && currentNormalized
                  ? { background: currentNormalized }
                  : {
                      background:
                        "conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
                    }
              }
            >
              {!isCustom && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">
                  +
                </span>
              )}
            </button>
            <input
              ref={inputRef}
              type="color"
              value={currentNormalized && !isGradientValue(currentNormalized) ? currentNormalized : "#000000"}
              onChange={(e) => onChange(normalize(e.target.value))}
              className="sr-only"
              aria-label="Vybrat vlastní barvu"
              tabIndex={-1}
            />
          </>
        )}
      </div>
    </div>
  );
}

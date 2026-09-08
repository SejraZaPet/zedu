import { Label } from "@/components/ui/label";
import ColorPicker from "@/components/admin/ColorPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BEZLI_GRADIENT,
  DEFAULT_GRADIENT_DIRECTION,
  GRADIENT_DIRECTIONS,
  GRADIENT_PRESETS,
  gradientCss,
  normalizeGradient,
  type SlideGradient,
} from "@/lib/slide-gradient";

interface Props {
  value: SlideGradient | null | undefined;
  onChange: (v: SlideGradient | null) => void;
  /** Popisek volby „bez přechodu“. */
  nullLabel?: string;
  className?: string;
}

/**
 * Volba barevného přechodu: hotové palety (včetně „Barvy Bezli“ z loga),
 * dvě vlastní barvy a směr.
 */
export const GradientPicker = ({ value, onChange, nullLabel = "Plná barva", className }: Props) => {
  const g = normalizeGradient(value);
  const current = g || BEZLI_GRADIENT;
  const set = (patch: Partial<SlideGradient>) =>
    onChange({ ...current, ...patch, direction: patch.direction ?? current.direction ?? DEFAULT_GRADIENT_DIRECTION });

  return (
    <div className={`space-y-2 ${className || ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`h-6 rounded border px-1.5 text-[10px] ${
            g ? "border-border text-muted-foreground" : "border-primary text-foreground"
          }`}
        >
          {nullLabel}
        </button>
        {GRADIENT_PRESETS.map((p) => {
          const active =
            !!g &&
            g.from.toLowerCase() === p.gradient.from.toLowerCase() &&
            g.to.toLowerCase() === p.gradient.to.toLowerCase() &&
            (g.direction || "") === (p.gradient.direction || "");
          return (
            <button
              key={p.label}
              type="button"
              title={p.label}
              aria-label={`Přechod ${p.label}`}
              onClick={() => onChange({ ...p.gradient })}
              className={`h-6 w-10 rounded border-2 ${active ? "border-primary scale-105" : "border-border"}`}
              style={{ backgroundImage: gradientCss(p.gradient) || undefined }}
            />
          );
        })}
      </div>

      {g && (
        <div className="space-y-2 rounded-md border border-border p-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">První barva</Label>
            <ColorPicker value={g.from} onChange={(v) => v && set({ from: v })} compact className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Druhá barva</Label>
            <ColorPicker value={g.to} onChange={(v) => v && set({ to: v })} compact className="mt-1" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">Směr</Label>
            <Select
              value={g.direction || DEFAULT_GRADIENT_DIRECTION}
              onValueChange={(v) => set({ direction: v })}
            >
              <SelectTrigger className="mt-1 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GRADIENT_DIRECTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div
            className="h-8 rounded border border-border"
            style={{ backgroundImage: gradientCss(g) || undefined }}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
};

export default GradientPicker;

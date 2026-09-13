/**
 * Vzhled aktivity na snímku prezentace – světlá/tmavá/vlastní karta,
 * velikost textu, rozbalení a zobrazení hlavičky.
 */

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Palette } from "lucide-react";
import ColorPicker from "@/components/admin/ColorPicker";
import {
  FONT_SCALE_MAX,
  FONT_SCALE_MIN,
  getActivitySlideAppearance,
  type ActivityLook,
  type ActivitySlideAppearance,
} from "@/lib/activity-slide-appearance";

interface Props {
  /** Aktuální hodnota `block.props.slideAppearance`. */
  value: unknown;
  onChange: (next: ActivitySlideAppearance) => void;
}

const LOOKS: { value: ActivityLook; label: string }[] = [
  { value: "light", label: "Světlá" },
  { value: "dark", label: "Tmavá" },
  { value: "custom", label: "Vlastní" },
];

const ActivityAppearanceControls = ({ value, onChange }: Props) => {
  const a = getActivitySlideAppearance(value);
  const patch = (p: Partial<ActivitySlideAppearance>) => onChange({ ...a, ...p });
  const step = (delta: number) =>
    patch({
      fontScale: Math.min(
        FONT_SCALE_MAX,
        Math.max(FONT_SCALE_MIN, Math.round((a.fontScale + delta) * 100) / 100),
      ),
    });

  return (
    <div className="space-y-2 rounded-lg border border-border p-2">
      <Label className="flex items-center gap-1.5 text-xs">
        <Palette className="h-3.5 w-3.5" /> Vzhled aktivity na snímku
      </Label>
      <p className="text-[11px] text-muted-foreground">
        Barvy karty aktivity nezávisí na pozadí snímku, takže text zůstane čitelný.
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {LOOKS.map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={a.look === o.value ? "default" : "outline"}
            aria-pressed={a.look === o.value}
            className="h-7 text-xs"
            onClick={() => patch({ look: o.value })}
          >
            {o.label}
          </Button>
        ))}
      </div>

      {a.look === "custom" && (
        <div className="space-y-2 rounded-md bg-muted/30 p-2">
          <div>
            <Label className="text-[11px]">Barva karty</Label>
            <ColorPicker
              compact
              allowNull
              nullLabel="Výchozí"
              value={a.cardColor ?? null}
              onChange={(v) => patch({ cardColor: v ?? undefined })}
            />
          </div>
          <div>
            <Label className="text-[11px]">Barva textu</Label>
            <ColorPicker
              compact
              allowNull
              nullLabel="Výchozí"
              value={a.textColor ?? null}
              onChange={(v) => patch({ textColor: v ?? undefined })}
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Label className="text-[11px]">Velikost textu</Label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0 text-xs"
            aria-label="Zmenšit text aktivity"
            onClick={() => step(-0.1)}
          >
            −
          </Button>
          <span className="w-10 text-center text-[11px] tabular-nums">
            {Math.round(a.fontScale * 100)}%
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 w-7 p-0 text-xs"
            aria-label="Zvětšit text aktivity"
            onClick={() => step(0.1)}
          >
            +
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="activity-expanded" className="text-[11px]">
          Rozbaleno na snímku
        </Label>
        <Switch
          id="activity-expanded"
          checked={a.expanded}
          onCheckedChange={(v) => patch({ expanded: v })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="activity-header" className="text-[11px]">
          Zobrazit hlavičku aktivity
        </Label>
        <Switch
          id="activity-header"
          checked={a.showHeader}
          onCheckedChange={(v) => patch({ showHeader: v })}
        />
      </div>
    </div>
  );
};

export default ActivityAppearanceControls;

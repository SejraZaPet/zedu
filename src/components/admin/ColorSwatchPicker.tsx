import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { STAFF_COLORS } from "@/lib/staff-colors";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (color: string) => void;
  label?: string;
}

/** Výběr barvy z předvolené palety (kolečka), bez volného color pickeru. */
const ColorSwatchPicker = ({ value, onChange, label = "Barva" }: Props) => (
  <div className="space-y-1">
    <Label>{label}</Label>
    <div className="flex flex-wrap gap-2">
      {STAFF_COLORS.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={c.label}
            aria-pressed={active}
            onClick={() => onChange(c.value)}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform",
              active ? "border-foreground scale-110" : "border-transparent hover:scale-105",
            )}
            style={{ backgroundColor: c.value }}
          >
            {active && <Check className="h-4 w-4 text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  </div>
);

export default ColorSwatchPicker;

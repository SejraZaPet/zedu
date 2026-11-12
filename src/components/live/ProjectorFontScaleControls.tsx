import { Button } from "@/components/ui/button";
import {
  PROJECTOR_FONT_SCALE_DEFAULT,
  PROJECTOR_FONT_SCALE_MAX,
  PROJECTOR_FONT_SCALE_MIN,
  PROJECTOR_FONT_SCALE_STEP,
} from "@/lib/projector-font-scale";

interface Props {
  value: number;
  onChange: (value: number) => void;
  className?: string;
}

/** Stejné ovládání čitelnosti na učitelské obrazovce i na projektoru. */
export default function ProjectorFontScaleControls({ value, onChange, className = "" }: Props) {
  return (
    <div className={`flex items-center gap-1 ${className}`} role="group" aria-label="Velikost písma projekce">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 px-2 text-sm font-semibold"
        aria-label="Zmenšit písmo projekce"
        title="Zmenšit písmo"
        disabled={value <= PROJECTOR_FONT_SCALE_MIN}
        onClick={() => onChange(value - PROJECTOR_FONT_SCALE_STEP)}
      >
        A−
      </Button>
      <output className="min-w-12 text-center text-xs tabular-nums" aria-live="polite" aria-label="Velikost písma projekce v procentech">
        {value} %
      </output>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 px-2 text-sm font-semibold"
        aria-label="Zvětšit písmo projekce"
        title="Zvětšit písmo"
        disabled={value >= PROJECTOR_FONT_SCALE_MAX}
        onClick={() => onChange(value + PROJECTOR_FONT_SCALE_STEP)}
      >
        A+
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-9 px-2 text-xs"
        disabled={value === PROJECTOR_FONT_SCALE_DEFAULT}
        onClick={() => onChange(PROJECTOR_FONT_SCALE_DEFAULT)}
      >
        Původní
      </Button>
    </div>
  );
}

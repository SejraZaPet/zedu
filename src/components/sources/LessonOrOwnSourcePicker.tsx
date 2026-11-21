import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import SourceInput from "@/components/sources/SourceInput";
import type { SourceBundle } from "@/lib/use-source-bundle";
import {
  OWN_SOURCE_HINT, OWN_SOURCE_PRIVACY, SCANNED_PDF_HINT, scannedPdfItems, usesLesson, usesOwn,
  type CombinedSource, type LessonOrOwnMode,
} from "@/lib/lesson-or-own-source";

const MODES: { value: LessonOrOwnMode; label: string }[] = [
  { value: "lesson", label: "Z lekce" }, { value: "own", label: "Vlastní materiál" }, { value: "both", label: "Obojí" },
];

/**
 * Sdílený výběr zdroje pro AI (pracovní list i aktivity z lekce).
 * Lekci vykreslí volající (`lessonSlot`); vlastní materiál = SourceInput. Nic neukládá.
 */
export default function LessonOrOwnSourcePicker({
  mode, onModeChange, bundle, lessonSlot, combined, disabled, idPrefix = "src",
}: {
  mode: LessonOrOwnMode; onModeChange: (m: LessonOrOwnMode) => void; bundle: SourceBundle;
  lessonSlot: ReactNode; combined: CombinedSource; disabled?: boolean; idPrefix?: string;
}) {
  const scanned = scannedPdfItems(bundle.items);
  const fmt = (n: number) => n.toLocaleString("cs-CZ");
  return (
    <div className="space-y-3 min-w-0">
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Zdroj pro AI</legend>
        <RadioGroup value={mode} onValueChange={(v) => onModeChange(v as LessonOrOwnMode)} disabled={disabled}
          className="grid grid-cols-3 gap-2">
          {MODES.map((m) => (
            <Label key={m.value} htmlFor={`${idPrefix}-${m.value}`}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-border px-2 text-sm has-[:checked]:border-primary">
              <RadioGroupItem id={`${idPrefix}-${m.value}`} value={m.value} />
              <span className="min-w-0 break-words">{m.label}</span>
            </Label>
          ))}
        </RadioGroup>
      </fieldset>
      {usesLesson(mode) && <div className="min-w-0">{lessonSlot}</div>}
      {usesOwn(mode) && (
        <div className="space-y-2 min-w-0">
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />{OWN_SOURCE_HINT}</p>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{OWN_SOURCE_PRIVACY}</p>
          <SourceInput bundle={bundle} disabled={disabled} />
          {scanned.length > 0 && <p role="status" className="text-xs text-destructive">{SCANNED_PDF_HINT}</p>}
        </div>
      )}
      <p aria-live="polite" className={combined.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
        Celkem {fmt(combined.chars)} / {fmt(combined.limit)} znaků{combined.message ? ` · ${combined.message}` : ""}
      </p>
    </div>
  );
}

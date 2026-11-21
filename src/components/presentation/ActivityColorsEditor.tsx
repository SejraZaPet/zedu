import { AlertTriangle } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  ACTIVITY_PALETTE, DEFAULT_ACTIVITY_COLORS, activityCardStyle, activityColorWarnings, readActivityColors, type ActivityColors,
} from "@/lib/activity-colors";

const ROWS: { key: keyof ActivityColors; label: string }[] = [
  { key: "card", label: "Pozadí karty" },
  { key: "text", label: "Barva textu" },
  { key: "answer", label: "Barva odpovědí" },
  { key: "accent", label: "Akcent a ohraničení" },
];

/** Výběr barev aktivity s paletou Bezli, vlastní barvou, náhledem a kontrolou kontrastu. */
export default function ActivityColorsEditor({ value, onChange }: { value: unknown; onChange: (next: ActivityColors | undefined) => void }) {
  const colors = readActivityColors(value);
  const warnings = activityColorWarnings(colors);
  const set = (key: keyof ActivityColors, hex: string) => onChange({ ...colors, [key]: hex.toUpperCase() });
  return (
    <div className="space-y-3">
      {ROWS.map((row) => {
        const current = colors[row.key] ?? DEFAULT_ACTIVITY_COLORS[row.key];
        return (
          <div key={row.key}>
            <Label className="text-xs">{row.label}</Label>
            <div className="mt-1 flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={row.label}>
              {ACTIVITY_PALETTE.map((p) => (
                <button
                  key={p.hex}
                  type="button"
                  role="radio"
                  aria-checked={current === p.hex}
                  aria-label={p.name}
                  title={p.name}
                  onClick={() => set(row.key, p.hex)}
                  className={`h-7 w-7 rounded-full border-2 ${current === p.hex ? "border-foreground ring-2 ring-ring ring-offset-1" : "border-border"}`}
                  style={{ backgroundColor: p.hex }}
                />
              ))}
              <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-border" title="Vlastní barva">
                <span className="sr-only">Vlastní barva – {row.label}</span>
                <input type="color" value={current} onChange={(e) => set(row.key, e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                <span aria-hidden className="block h-full w-full" style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }} />
              </label>
            </div>
          </div>
        );
      })}

      <div data-activity-surface className="rounded-xl border-2 p-3 text-xs" style={activityCardStyle(colors)} aria-label="Náhled barev">
        <p className="font-semibold">Náhled otázky</p>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <span className="rounded-lg px-2 py-1" style={{ backgroundColor: "var(--activity-answer)", color: "var(--activity-answer-text)" }}>Odpověď</span>
          <span className="rounded-lg border-2 px-2 py-1" style={{ backgroundColor: "var(--activity-answer)", color: "var(--activity-answer-text)", borderColor: "var(--activity-accent)" }}>Správná</span>
        </div>
      </div>

      {warnings.map((w) => (
        <p key={w} role="alert" className="flex gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-foreground">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" /> {w}
        </p>
      ))}
      {Object.keys(colors).length > 0 && (
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => onChange(undefined)}>Vrátit výchozí barvy</Button>
      )}
    </div>
  );
}

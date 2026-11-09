/**
 * Výběr času na odpověď u slidu (ukládá activitySpec.timeLimitSec).
 * undefined = podle nastavení hry (dnešní chování), 0 = bez limitu.
 */
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MAX_TIME_LIMIT_SEC, MIN_TIME_LIMIT_SEC, TIME_LIMIT_PRESETS_SEC } from "@/lib/live-timing";

const INHERIT = "inherit";
const NONE = "none";
const CUSTOM = "custom";

export const timeLimitSelectValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return INHERIT;
  const n = Number(value);
  if (!Number.isFinite(n)) return INHERIT;
  if (n <= 0) return NONE;
  return (TIME_LIMIT_PRESETS_SEC as readonly number[]).includes(n) ? String(n) : CUSTOM;
};

interface Props {
  value: number | undefined;
  onChange: (next: number | undefined) => void;
}

const TimeLimitPicker = ({ value, onChange }: Props) => {
  const id = useId();
  const selected = timeLimitSelectValue(value);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">Čas na odpověď</Label>
      <Select
        value={selected}
        onValueChange={(v) => {
          if (v === INHERIT) onChange(undefined);
          else if (v === NONE) onChange(0);
          else if (v === CUSTOM) onChange(Number(value) > 0 ? Number(value) : 40);
          else onChange(Number(v));
        }}
      >
        <SelectTrigger id={id} className="h-8 text-xs" aria-label="Čas na odpověď">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={INHERIT}>Podle nastavení hry</SelectItem>
          {TIME_LIMIT_PRESETS_SEC.map((s) => (
            <SelectItem key={s} value={String(s)}>{s} s</SelectItem>
          ))}
          <SelectItem value={CUSTOM}>Vlastní…</SelectItem>
          <SelectItem value={NONE}>Bez limitu</SelectItem>
        </SelectContent>
      </Select>
      {selected === CUSTOM && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={MIN_TIME_LIMIT_SEC}
            max={MAX_TIME_LIMIT_SEC}
            className="h-8 w-24 text-xs"
            value={Number(value) || ""}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (Number.isFinite(n) && n > 0) onChange(Math.min(MAX_TIME_LIMIT_SEC, Math.max(MIN_TIME_LIMIT_SEC, n)));
            }}
            aria-label="Vlastní čas v sekundách"
          />
          <span className="text-xs text-muted-foreground">s ({MIN_TIME_LIMIT_SEC}–{MAX_TIME_LIMIT_SEC})</span>
        </div>
      )}
      <p className="text-[11px] leading-snug text-muted-foreground">
        Po vypršení času se výsledky otázky zveřejní samy.
      </p>
    </div>
  );
};

export default TimeLimitPicker;

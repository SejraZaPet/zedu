import type { WorksheetItemProps } from "./types";
import { normalizeMethodPhases, methodStepsTotalPoints } from "@/lib/method-steps";
import { Textarea } from "@/components/ui/textarea";

/**
 * Pracovní list: „Postup podle metody“ – fáze jako očíslované karty pod sebou.
 * Odpovědi žáka se ukládají jako string[] v pořadí fází se způsobem odpovědi
 * řádky/pole. Hodnocení je ruční (jako otevřená odpověď); fáze s 0 body se
 * do maxima nepočítají.
 */
export default function MethodStepsItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  const phases = normalizeMethodPhases(item.methodPhases);
  const answers = Array.isArray(value) ? value.map((v) => String(v ?? "")) : [];
  const total = methodStepsTotalPoints(phases);

  let answerIndex = -1;
  return (
    <div className="space-y-3">
      {item.methodName ? (
        <p className="text-xs text-muted-foreground">
          Metoda: <span className="font-medium text-foreground">{item.methodName}</span>
        </p>
      ) : null}
      {item.methodIntro ? <p className="text-sm whitespace-pre-wrap">{item.methodIntro}</p> : null}
      <ol className="space-y-3">
        {phases.map((phase, i) => {
          const answerable = phase.answerMode !== "none";
          if (answerable) answerIndex += 1;
          const idx = answerIndex;
          return (
            <li key={phase.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold">
                  {i + 1}. {phase.title || "Fáze"}
                </p>
                {phase.points > 0 ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{phase.points} b.</span>
                ) : null}
              </div>
              {phase.task ? <p className="mt-1 text-sm whitespace-pre-wrap">{phase.task}</p> : null}
              {answerable ? (
                <Textarea
                  className="mt-2 min-h-[44px] text-sm"
                  rows={phase.answerMode === "lines" ? 3 : 2}
                  value={answers[idx] ?? ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...answers];
                    next[idx] = e.target.value;
                    onChange(next);
                  }}
                  placeholder="Vaše odpověď…"
                  aria-label={`Odpověď k fázi ${i + 1}`}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
      {total > 0 ? (
        <p className="text-xs text-muted-foreground">Hodnotí učitel, celkem až {total} b.</p>
      ) : null}
    </div>
  );
}

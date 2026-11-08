import type { WorksheetItemProps } from "./types";
import { normalizePracticeExamples, practiceExamplesTotalPoints } from "@/lib/method-steps";
import { Textarea } from "@/components/ui/textarea";

/**
 * Pracovní list: „Příklady z praxe“ – karty se situací a volitelnou otázkou.
 * Odpovědi žáka se ukládají jako string[] v pořadí příkladů s otázkou.
 * Hodnocení je ruční; příklady s 0 body se do maxima nepočítají.
 */
export default function PracticeExamplesItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  const examples = normalizePracticeExamples(item.practiceExamples);
  const answers = Array.isArray(value) ? value.map((v) => String(v ?? "")) : [];
  const total = practiceExamplesTotalPoints(examples);

  let answerIndex = -1;
  return (
    <div className="space-y-3">
      {examples.map((ex, i) => {
        const hasQuestion = !!(ex.question ?? "").trim();
        if (hasQuestion) answerIndex += 1;
        const idx = answerIndex;
        return (
          <div key={ex.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-semibold">
                {i + 1}. {ex.title || "Příklad"}
              </p>
              {ex.points > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">{ex.points} b.</span>
              ) : null}
            </div>
            {ex.situation ? <p className="mt-1 text-sm whitespace-pre-wrap">{ex.situation}</p> : null}
            {hasQuestion ? (
              <>
                <p className="mt-2 text-sm font-medium">{ex.question}</p>
                <Textarea
                  className="mt-2 min-h-[44px] text-sm"
                  rows={2}
                  value={answers[idx] ?? ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = [...answers];
                    next[idx] = e.target.value;
                    onChange(next);
                  }}
                  placeholder="Vaše odpověď…"
                  aria-label={`Odpověď k příkladu ${i + 1}`}
                />
              </>
            ) : null}
          </div>
        );
      })}
      {total > 0 ? (
        <p className="text-xs text-muted-foreground">Hodnotí učitel, celkem až {total} b.</p>
      ) : null}
    </div>
  );
}

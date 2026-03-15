import { useState, useMemo } from "react";
import { t } from "@/lib/t";

interface MatchingData { left: string[]; right: string[]; }

const MatchingActivity = ({ matching, onComplete }: { matching: MatchingData; onComplete?: (score: number, maxScore: number) => void }) => {
  const [selections, setSelections] = useState<Record<number, number | null>>({});
  const [checked, setChecked] = useState(false);

  // Shuffle right side once
  const shuffledRight = useMemo(() => {
    const indices = matching.right.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matching.right.join(",")]);

  if (!matching?.left?.length) return null;

  const allPaired = matching.left.every((_, i) => selections[i] != null);
  const isCorrectPair = (l: number, r: number) => l === r;

  const handleSelect = (leftIdx: number, rightOrigIdx: number) => {
    if (checked) return;
    setSelections((prev) => ({ ...prev, [leftIdx]: rightOrigIdx }));
  };

  const handleCheck = () => {
    setChecked(true);
    const correct = matching.left.filter((_, i) => selections[i] != null && isCorrectPair(i, selections[i]!)).length;
    onComplete?.(correct, matching.left.length);
  };

  const handleReset = () => {
    setChecked(false);
    setSelections({});
  };

  const allCorrect = checked && allPaired && matching.left.every((_, i) => isCorrectPair(i, selections[i]!));

  // Collect already-selected right indices so they can be shown as disabled
  const usedRight = new Set(Object.values(selections).filter((v): v is number => v != null));

  return (
    <div className="space-y-4" role="group" aria-label={t("a11y.matching.instruction")}>
      <p className="text-sm text-muted-foreground sr-only">{t("a11y.matching.instruction")}</p>

      <div className="space-y-3">
        {matching.left.map((item, leftIdx) => {
          const selectedRight = selections[leftIdx];
          const pairCorrect = checked && selectedRight != null && isCorrectPair(leftIdx, selectedRight);
          const pairWrong = checked && selectedRight != null && !isCorrectPair(leftIdx, selectedRight);

          return (
            <div
              key={leftIdx}
              className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-lg border p-3 transition-colors ${
                pairCorrect
                  ? "border-green-500/60 bg-green-500/10"
                  : pairWrong
                    ? "border-destructive/60 bg-destructive/10"
                    : "border-border bg-card"
              }`}
            >
              <span className="text-sm font-medium text-foreground min-w-0 flex-1">
                {item}
              </span>

              <select
                aria-label={t("a11y.matching.selectMatch", item)}
                value={selectedRight != null ? String(selectedRight) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  handleSelect(leftIdx, val === "" ? null as any : Number(val));
                }}
                disabled={checked}
                className="w-full sm:w-48 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              >
                <option value="">{t("a11y.matching.chooseOption")}</option>
                {shuffledRight.map((origIdx) => {
                  const isUsedElsewhere = usedRight.has(origIdx) && selections[leftIdx] !== origIdx;
                  return (
                    <option key={origIdx} value={String(origIdx)} disabled={isUsedElsewhere}>
                      {matching.right[origIdx]}
                    </option>
                  );
                })}
              </select>
            </div>
          );
        })}
      </div>

      {allPaired && !checked && (
        <button
          onClick={handleCheck}
          className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          {t("a11y.matching.checkAnswers")}
        </button>
      )}

      {checked && (
        <div
          role="alert"
          className={`rounded-lg p-3 text-sm ${allCorrect ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}
        >
          {allCorrect ? `✓ ${t("a11y.matching.allCorrect")}` : `✗ ${t("a11y.matching.someWrong")}`}
          {!allCorrect && (
            <button className="ml-3 underline text-xs" onClick={handleReset}>
              {t("a11y.matching.tryAgain")}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchingActivity;

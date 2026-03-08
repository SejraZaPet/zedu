import { useState, useMemo } from "react";

interface MatchingData { left: string[]; right: string[]; }

const MatchingActivity = ({ matching, onComplete }: { matching: MatchingData; onComplete?: (score: number, maxScore: number) => void }) => {
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [pairs, setPairs] = useState<[number, number][]>([]);
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

  const pairedLeft = new Set(pairs.map((p) => p[0]));
  const pairedRight = new Set(pairs.map((p) => p[1]));

  const handleRight = (rightIdx: number) => {
    if (checked || pairedRight.has(rightIdx) || selectedLeft === null) return;
    setPairs((p) => [...p, [selectedLeft, rightIdx]]);
    setSelectedLeft(null);
  };

  const isCorrectPair = (l: number, r: number) => l === r; // correct when indices match (left[i] pairs with right[i])

  const allCorrect = checked && pairs.length === matching.left.length && pairs.every(([l, r]) => isCorrectPair(l, r));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {matching.left.map((item, i) => (
            <button
              key={i}
              onClick={() => !checked && !pairedLeft.has(i) && setSelectedLeft(i)}
              className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                pairedLeft.has(i)
                  ? checked
                    ? pairs.find((p) => p[0] === i && isCorrectPair(p[0], p[1]))
                      ? "border-green-500/60 bg-green-500/10"
                      : "border-destructive/60 bg-destructive/10"
                    : "border-primary/40 bg-primary/5 opacity-60"
                  : selectedLeft === i
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card hover:border-primary/50"
              }`}
            >
              <span className="text-foreground">{item}</span>
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {shuffledRight.map((origIdx) => (
            <button
              key={origIdx}
              onClick={() => handleRight(origIdx)}
              className={`w-full text-left rounded-lg border p-3 text-sm transition-colors ${
                pairedRight.has(origIdx)
                  ? "border-primary/40 bg-primary/5 opacity-60"
                  : selectedLeft !== null
                    ? "border-border bg-card hover:border-primary/50 cursor-pointer"
                    : "border-border bg-card cursor-default"
              }`}
            >
              <span className="text-foreground">{matching.right[origIdx]}</span>
            </button>
          ))}
        </div>
      </div>
      {pairs.length === matching.left.length && !checked && (
        <button onClick={() => {
          setChecked(true);
          const correct = pairs.filter(([l, r]) => isCorrectPair(l, r)).length;
          onComplete?.(correct, matching.left.length);
        }} className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
          Ověřit
        </button>
      )}
      {checked && (
        <div className={`rounded-lg p-3 text-sm ${allCorrect ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
          {allCorrect ? "✓ Všechny páry jsou správně!" : "✗ Některé páry jsou špatně."}
          {!allCorrect && (
            <button className="ml-3 underline text-xs" onClick={() => { setChecked(false); setPairs([]); setSelectedLeft(null); }}>
              Zkusit znovu
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchingActivity;

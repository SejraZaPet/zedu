import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Statement {
  text: string;
  isTrue: boolean;
}

interface Props {
  statements: Statement[];
  onComplete?: (score: number, maxScore: number) => void;
}

const TrueFalseActivity = ({ statements = [], onComplete }: Props) => {
  const [answers, setAnswers] = useState<(boolean | null)[]>(() =>
    statements.map(() => null)
  );
  const [checked, setChecked] = useState(false);

  const results = useMemo(() => {
    if (!checked) return null;
    return statements.map((s, i) => answers[i] === s.isTrue);
  }, [checked, answers, statements]);

  const correctCount = results?.filter(Boolean).length ?? 0;
  const total = statements.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleSelect = (idx: number, val: boolean) => {
    if (checked) return;
    const next = [...answers];
    next[idx] = val;
    setAnswers(next);
  };

  const reset = () => {
    setAnswers(statements.map(() => null));
    setChecked(false);
  };

  if (!statements.length) return null;

  return (
    <div className="space-y-4">
      {/* Results banner */}
      {checked && results && (
        <div
          className={`rounded-lg px-4 py-3 flex items-center gap-3 text-sm font-medium ${
            percentage === 100
              ? "bg-green-500/15 text-green-400 border border-green-500/30"
              : percentage >= 50
              ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
              : "bg-destructive/15 text-destructive border border-destructive/30"
          }`}
        >
          {percentage === 100 ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>
            {correctCount} / {total} správně ({percentage} %)
          </span>
        </div>
      )}

      {/* Statements */}
      <div className="space-y-2">
        {statements.map((statement, i) => {
          const selected = answers[i];
          const isCorrect = results?.[i];

          return (
            <div
              key={i}
              className={`rounded-lg border p-4 transition-colors ${
                checked
                  ? isCorrect
                    ? "border-green-500/40 bg-green-500/5"
                    : "border-destructive/40 bg-destructive/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm text-foreground flex-1 pt-1">
                  {statement.text}
                </p>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleSelect(i, true)}
                    disabled={checked}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      checked && selected === true
                        ? isCorrect
                          ? "bg-green-500/20 border-green-500/50 text-green-400"
                          : "bg-destructive/20 border-destructive/50 text-destructive"
                        : checked && statement.isTrue
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : selected === true
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    Pravda
                  </button>
                  <button
                    onClick={() => handleSelect(i, false)}
                    disabled={checked}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      checked && selected === false
                        ? isCorrect
                          ? "bg-green-500/20 border-green-500/50 text-green-400"
                          : "bg-destructive/20 border-destructive/50 text-destructive"
                        : checked && !statement.isTrue
                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                        : selected === false
                        ? "bg-primary/20 border-primary text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    Nepravda
                  </button>
                </div>
              </div>
              {checked && !isCorrect && (
                <p className="text-xs text-muted-foreground mt-2">
                  Správná odpověď: {statement.isTrue ? "Pravda" : "Nepravda"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        {!checked && (
          <Button
            size="sm"
            onClick={() => {
              setChecked(true);
              const correct = statements.filter((s, i) => answers[i] === s.isTrue).length;
              onComplete?.(correct, statements.length);
            }}
            disabled={answers.some((a) => a === null)}
          >
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Zkontrolovat
          </Button>
        )}
        {checked && (
          <Button size="sm" variant="outline" onClick={reset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Zkusit znovu
          </Button>
        )}
      </div>
    </div>
  );
};

export default TrueFalseActivity;

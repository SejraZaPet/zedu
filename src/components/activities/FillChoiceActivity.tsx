import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface FillChoiceToken {
  type: "text" | "blank";
  value?: string;
  answer?: string;
}

interface Props {
  tokens: FillChoiceToken[];
  options: string[];
  onComplete?: (score: number, maxScore: number) => void;
}

const FillChoiceActivity = ({ tokens = [], options = [], onComplete }: Props) => {
  const blanks = useMemo(
    () => tokens.filter((t) => t.type === "blank"),
    [tokens]
  );

  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    blanks.map(() => null)
  );
  const [checked, setChecked] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  // Shuffle options once
  const shuffledOptions = useMemo(() => {
    const arr = [...options];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.join(",")]);

  const results = useMemo(() => {
    if (!checked) return null;
    return blanks.map(
      (blank, i) =>
        answers[i]?.trim().toLowerCase() === blank.answer?.trim().toLowerCase()
    );
  }, [checked, answers, blanks]);

  const correctCount = results?.filter(Boolean).length ?? 0;
  const total = blanks.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleSelect = (blankIdx: number, word: string) => {
    const next = [...answers];
    next[blankIdx] = word;
    setAnswers(next);
    setOpenIdx(null);
  };

  const reset = () => {
    setAnswers(blanks.map(() => null));
    setChecked(false);
    setOpenIdx(null);
  };

  if (!blanks.length)
    return (
      <p className="text-muted-foreground text-sm">
        Žádné mezery k doplnění.
      </p>
    );

  let blankCounter = 0;

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

      {/* Text with clickable blanks */}
      <div className="text-foreground leading-loose text-base flex flex-wrap items-baseline gap-y-2">
        {tokens.map((token, i) => {
          if (token.type === "text") {
            return <span key={i}>{token.value}</span>;
          }

          const idx = blankCounter++;
          const selected = answers[idx];
          const isCorrect = results?.[idx];

          const bgClass = checked
            ? isCorrect
              ? "border-green-500 bg-green-500/10 text-green-400"
              : "border-destructive bg-destructive/10 text-destructive"
            : selected
            ? "border-primary bg-primary/10 text-foreground"
            : "border-border bg-muted/30 text-muted-foreground";

          return (
            <Popover
              key={i}
              open={openIdx === idx && !checked}
              onOpenChange={(open) => setOpenIdx(open ? idx : null)}
            >
              <PopoverTrigger asChild>
                <button
                  disabled={checked}
                  className={`inline-flex items-center justify-center min-w-[80px] h-8 px-3 mx-1 rounded-md border text-sm font-medium transition-colors ${bgClass} ${
                    !checked ? "hover:border-primary/60 cursor-pointer" : ""
                  }`}
                >
                  {selected || "…"}
                  {checked && isCorrect && (
                    <CheckCircle2 className="w-3.5 h-3.5 ml-1.5 inline" />
                  )}
                  {checked && !isCorrect && (
                    <XCircle className="w-3.5 h-3.5 ml-1.5 inline" />
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-2 max-h-[200px] overflow-y-auto"
                align="start"
              >
                <div className="flex flex-col gap-1">
                  {shuffledOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => handleSelect(idx, opt)}
                      className={`text-left px-3 py-1.5 rounded text-sm transition-colors ${
                        selected === opt
                          ? "bg-primary/20 text-primary"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          );
        })}
      </div>

      {/* Show correct answers when wrong */}
      {checked && results && percentage < 100 && (
        <div className="text-xs text-muted-foreground space-y-0.5">
          {blanks.map((blank, i) =>
            !results[i] ? (
              <div key={i}>
                Mezera {i + 1}: správně „
                <span className="text-green-400">{blank.answer}</span>"
                {answers[i] && (
                  <>
                    , tvá odpověď „
                    <span className="text-destructive">{answers[i]}</span>"
                  </>
                )}
              </div>
            ) : null
          )}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2 pt-2">
        {!checked && (
          <Button
            size="sm"
            onClick={() => {
              setChecked(true);
              const correct = blanks.filter((blank, i) => answers[i]?.trim().toLowerCase() === blank.answer?.trim().toLowerCase()).length;
              onComplete?.(correct, blanks.length);
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

export default FillChoiceActivity;

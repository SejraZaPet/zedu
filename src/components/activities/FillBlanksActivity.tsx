import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, RotateCcw } from "lucide-react";

interface Blank {
  answer: string;
  alternatives: string[];
}

interface Props {
  text: string;
  caseSensitive?: boolean;
  diacriticSensitive?: boolean;
}

const normalize = (s: string, caseSensitive: boolean, diacriticSensitive: boolean) => {
  let v = s.trim();
  if (!caseSensitive) v = v.toLowerCase();
  if (!diacriticSensitive) v = v.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return v;
};

const parseBlanks = (text: string): { segments: (string | number)[]; blanks: Blank[] } => {
  const blanks: Blank[] = [];
  const segments: (string | number)[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) segments.push(text.slice(last, match.index));
    const parts = match[1].split("/").map((s) => s.trim());
    blanks.push({ answer: parts[0], alternatives: parts.slice(1) });
    segments.push(blanks.length - 1);
    last = regex.lastIndex;
  }
  if (last < text.length) segments.push(text.slice(last));
  return { segments, blanks };
};

const FillBlanksActivity = ({ text, caseSensitive = false, diacriticSensitive = true }: Props) => {
  const { segments, blanks } = useMemo(() => parseBlanks(text || ""), [text]);
  const [answers, setAnswers] = useState<string[]>(() => blanks.map(() => ""));
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const results = useMemo(() => {
    if (!checked) return null;
    return blanks.map((blank, i) => {
      const input = normalize(answers[i], caseSensitive, diacriticSensitive);
      const accepted = [blank.answer, ...blank.alternatives].map((a) =>
        normalize(a, caseSensitive, diacriticSensitive)
      );
      return accepted.includes(input);
    });
  }, [checked, answers, blanks, caseSensitive, diacriticSensitive]);

  const correctCount = results?.filter(Boolean).length ?? 0;
  const total = blanks.length;
  const percentage = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const handleUpdate = (idx: number, val: string) => {
    const next = [...answers];
    next[idx] = val;
    setAnswers(next);
  };

  const reset = () => {
    setAnswers(blanks.map(() => ""));
    setChecked(false);
    setShowSolution(false);
  };

  if (!blanks.length) return <p className="text-muted-foreground text-sm">Žádné mezery k doplnění.</p>;

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

      {/* Text with blanks */}
      <div className="text-foreground leading-loose text-base flex flex-wrap items-baseline gap-y-2">
        {segments.map((seg, i) => {
          if (typeof seg === "string") {
            return <span key={i}>{seg}</span>;
          }
          const idx = seg;
          const isCorrect = results?.[idx];
          const borderClass = checked
            ? isCorrect
              ? "border-green-500 bg-green-500/10"
              : "border-destructive bg-destructive/10"
            : "border-border";

          if (showSolution && checked && !isCorrect) {
            return (
              <span key={i} className="inline-flex flex-col items-center mx-1">
                <Input
                  value={answers[idx]}
                  disabled
                  className={`inline-block w-auto min-w-[80px] max-w-[200px] text-center text-sm h-8 ${borderClass}`}
                  style={{ width: `${Math.max(80, answers[idx].length * 10 + 30)}px` }}
                />
                <span className="text-xs text-green-400 mt-0.5">{blanks[idx].answer}</span>
              </span>
            );
          }

          return (
            <Input
              key={i}
              value={answers[idx]}
              onChange={(e) => handleUpdate(idx, e.target.value)}
              disabled={checked}
              className={`inline-block w-auto min-w-[80px] max-w-[200px] text-center text-sm h-8 mx-1 ${borderClass}`}
              style={{ width: `${Math.max(80, answers[idx].length * 10 + 30)}px` }}
              placeholder="…"
            />
          );
        })}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 pt-2">
        {!checked && (
          <Button size="sm" onClick={() => setChecked(true)} disabled={answers.some((a) => !a.trim())}>
            <CheckCircle2 className="w-4 h-4 mr-1" />
            Zkontrolovat
          </Button>
        )}
        {checked && !showSolution && percentage < 100 && (
          <Button size="sm" variant="outline" onClick={() => setShowSolution(true)}>
            Zobrazit řešení
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

export default FillBlanksActivity;

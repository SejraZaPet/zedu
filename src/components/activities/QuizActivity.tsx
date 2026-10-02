import { useState } from "react";
import { getQuizQuestions } from "@/lib/quiz-questions";
import { Button } from "@/components/ui/button";
import { getMcqOptionName, getMcqOptionStyle, McqOptionIcon } from "@/components/live/McqAnswerChoice";

/**
 * Kvíz s jednou nebo více otázkami – žák prochází otázky postupně,
 * ověří odpověď, vidí vysvětlení a na konci celkové skóre.
 */
interface LiveMode {
  /** Výsledky otázky jsou zveřejněné — teprve teď se ukáže správnost. */
  revealed: boolean;
  /** Dříve odeslaný výběr (např. po obnovení stránky). */
  initialSelected?: number[] | null;
  onSubmit: (isCorrect: boolean, selected: number[]) => void;
}

const QuizActivity = ({ quiz, onComplete, live }: { quiz: any; onComplete?: (score: number, maxScore: number) => void; live?: LiveMode }) => {
  const questions = getQuizQuestions(quiz);
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Set<number>>(() => new Set(live?.initialSelected ?? []));
  const [submitted, setSubmitted] = useState(!!live?.initialSelected);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length === 0) return null;

  const current = questions[index];
  const correctCount = current.answers.filter((a) => a.correct).length;
  const isMulti = correctCount > 1;
  const isCorrect = current.answers.every((a, i) => (a.correct ? selected.has(i) : !selected.has(i)));

  const toggle = (i: number) => {
    if (submitted) return;
    if (live && !isMulti) {
      const next = new Set([i]);
      setSelected(next);
      setSubmitted(true);
      const correct = current.answers.every((a, answerIndex) => (a.correct ? next.has(answerIndex) : !next.has(answerIndex)));
      live.onSubmit(correct, [i]);
      return;
    }
    setSelected((s) => {
      const next = new Set(s);
      if (isMulti) next.has(i) ? next.delete(i) : next.add(i);
      else if (live) { next.clear(); next.add(i); }
      else next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const check = () => {
    setSubmitted(true);
    if (live) {
      live.onSubmit(isCorrect, [...selected].sort((a, b) => a - b));
      return;
    }
    if (isCorrect) setScore((s) => s + 1);
  };

  if (live) {
    const show = submitted && live.revealed;
    return (
      <div className="space-y-4">
        <p className="sr-only">Odpověz podle možností zobrazených na společné obrazovce.</p>
        {isMulti && <p className="text-sm text-muted-foreground">Vyber všechny odpovídající tvary a potom odpověď odešli.</p>}
        <div className="grid grid-cols-2 gap-3" aria-label="Možnosti odpovědi">
          {current.answers.map((a, i) => {
            const optionName = getMcqOptionName(i);
            return (
              <Button
                key={i}
                onClick={() => toggle(i)}
                disabled={submitted || live.revealed}
                aria-label={`Možnost ${i + 1}: ${optionName}`}
                aria-pressed={selected.has(i)}
                className={`h-24 min-h-11 border-b-4 text-primary-foreground shadow-md transition-transform enabled:hover:scale-[1.02] enabled:active:scale-95 ${getMcqOptionStyle(i)} ${selected.has(i) ? "ring-4 ring-foreground ring-offset-2 ring-offset-background" : ""} ${show && !a.correct ? "opacity-35" : ""}`}
              >
                <span className="[&>svg]:h-12 [&>svg]:w-12">
                  <McqOptionIcon index={i} />
                </span>
                <span className="sr-only">{optionName}</span>
                {show && a.correct && <span className="absolute right-3 top-2 text-2xl" aria-label="Správná odpověď">✓</span>}
              </Button>
            );
          })}
        </div>
        {isMulti && !submitted && !live.revealed && selected.size > 0 && (
          <Button
            onClick={check}
          >
            Odeslat odpověď
          </Button>
        )}
        {submitted && !live.revealed && (
          <div className="rounded-lg p-3 text-sm bg-muted text-muted-foreground" role="status" aria-live="polite">
            ✓ Odpověď odeslána. Počkej na výsledky.
          </div>
        )}
        {show && (
          <div role="status" aria-live="polite" className={`rounded-lg p-3 text-sm ${isCorrect ? "bg-green-500/10 text-green-600" : "bg-destructive/10 text-destructive"}`}>
            {isCorrect ? "✓ Správně!" : "✗ Špatně."}
            {current.explanation && <p className="mt-2 text-muted-foreground">{current.explanation}</p>}
          </div>
        )}
        {live.revealed && !submitted && (
          <div className="rounded-lg p-3 text-sm bg-muted text-muted-foreground" role="status">
            Výsledky už jsou zveřejněné.
          </div>
        )}
      </div>
    );
  }


  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      setSelected(new Set());
      setSubmitted(false);
    } else {
      setDone(true);
      onComplete?.(score, questions.length);
    }
  };

  if (done) {
    return (
      <div className="space-y-3">
        <p className="text-foreground font-medium">
          Hotovo – {score} z {questions.length} správně.
        </p>
        <button
          onClick={() => {
            setIndex(0);
            setSelected(new Set());
            setSubmitted(false);
            setScore(0);
            setDone(false);
          }}
          className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Zkusit znovu
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.length > 1 && (
        <p className="text-xs text-muted-foreground">
          Otázka {index + 1} z {questions.length}
        </p>
      )}
      <p className="text-foreground font-medium text-lg">{current.question}</p>
      {isMulti && <p className="text-xs text-muted-foreground">Vyberte všechny správné odpovědi</p>}
      <div className="space-y-2">
        {current.answers.map((a, i) => {
          let cls = "border-border bg-card hover:border-primary/50";
          if (submitted && a.correct) cls = "border-green-500/60 bg-green-500/10";
          else if (submitted && selected.has(i) && !a.correct) cls = "border-destructive/60 bg-destructive/10";
          else if (selected.has(i)) cls = "border-primary bg-primary/10";

          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              className={`w-full text-left rounded-lg border p-3 transition-colors ${cls}`}
            >
              <span className="text-foreground text-sm">{a.text}</span>
            </button>
          );
        })}
      </div>
      {!submitted && selected.size > 0 && (
        <button
          onClick={check}
          className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Ověřit odpověď
        </button>
      )}
      {submitted && (
        <div className={`rounded-lg p-3 text-sm ${isCorrect ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
          {isCorrect ? "✓ Správně!" : "✗ Špatně."}
          {current.explanation && <p className="mt-2 text-muted-foreground">{current.explanation}</p>}
          <div className="mt-2 flex gap-3">
            <button className="underline text-xs" onClick={next}>
              {index + 1 < questions.length ? "Další otázka" : "Zobrazit výsledek"}
            </button>
            {!isCorrect && (
              <button
                className="underline text-xs"
                onClick={() => {
                  setSubmitted(false);
                  setSelected(new Set());
                }}
              >
                Zkusit tuto otázku znovu
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default QuizActivity;

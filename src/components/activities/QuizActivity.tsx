import { useState } from "react";

interface Answer { text: string; correct: boolean; }
interface QuizData { question: string; answers: Answer[]; explanation?: string; }

const QuizActivity = ({ quiz }: { quiz: QuizData }) => {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [submitted, setSubmitted] = useState(false);

  if (!quiz?.question) return null;

  const toggle = (i: number) => {
    if (submitted) return;
    setSelected((s) => {
      const next = new Set(s);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const correctCount = quiz.answers.filter((a) => a.correct).length;
  const isMulti = correctCount > 1;

  const allCorrect = submitted && quiz.answers.every((a, i) =>
    a.correct ? selected.has(i) : !selected.has(i)
  );

  return (
    <div className="space-y-4">
      <p className="text-foreground font-medium text-lg">{quiz.question}</p>
      {isMulti && <p className="text-xs text-muted-foreground">Vyberte všechny správné odpovědi</p>}
      <div className="space-y-2">
        {quiz.answers.map((a, i) => {
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
          onClick={() => setSubmitted(true)}
          className="rounded-lg bg-primary px-5 py-2 text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Ověřit odpověď
        </button>
      )}
      {submitted && (
        <div className={`rounded-lg p-3 text-sm ${allCorrect ? "bg-green-500/10 text-green-400" : "bg-destructive/10 text-destructive"}`}>
          {allCorrect ? "✓ Správně!" : "✗ Špatně, zkuste to znovu."}
          {quiz.explanation && <p className="mt-2 text-muted-foreground">{quiz.explanation}</p>}
          {!allCorrect && (
            <button className="mt-2 underline text-xs" onClick={() => { setSubmitted(false); setSelected(new Set()); }}>
              Zkusit znovu
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default QuizActivity;

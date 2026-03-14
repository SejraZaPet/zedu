import { GameQuestion } from "@/lib/game-types";
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

interface Props {
  question: GameQuestion;
  questionIndex: number;
  totalQuestions: number;
  hasAnswered: boolean;
  lastResult: { correct: boolean; score: number } | null;
  onAnswer: (answerIndex: number) => void;
  timeLimit: number;
  questionStarted: number;
  status: string;
}

const ANSWER_COLORS = [
  "bg-red-500 hover:bg-red-600 active:bg-red-700",
  "bg-blue-500 hover:bg-blue-600 active:bg-blue-700",
  "bg-green-500 hover:bg-green-600 active:bg-green-700",
  "bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700",
];

const ANSWER_ICONS = ["▲", "◆", "●", "■"];

export const StudentGameQuestion = ({
  question,
  questionIndex,
  totalQuestions,
  hasAnswered,
  lastResult,
  onAnswer,
  timeLimit,
  questionStarted,
  status,
}: Props) => {
  const [countdown, setCountdown] = useState<number>(timeLimit / 1000);

  useEffect(() => {
    if (status !== "playing") return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - questionStarted;
      const remaining = Math.max(0, Math.ceil((timeLimit - elapsed) / 1000));
      setCountdown(remaining);
    }, 100);
    return () => clearInterval(interval);
  }, [questionStarted, timeLimit, status]);

  // Waiting for results
  if (hasAnswered || status === "question_results") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-background">
        {lastResult ? (
          <div className="text-center space-y-4 animate-scale-in">
            {lastResult.correct ? (
              <>
                <CheckCircle2 className="w-20 h-20 text-green-500 mx-auto" />
                <h2 className="text-3xl font-heading font-bold text-green-500">Správně!</h2>
                <p className="text-5xl font-bold font-mono text-primary">+{lastResult.score}</p>
              </>
            ) : (
              <>
                <XCircle className="w-20 h-20 text-destructive mx-auto" />
                <h2 className="text-3xl font-heading font-bold text-destructive">Špatně</h2>
                <p className="text-2xl font-mono text-muted-foreground">+0</p>
              </>
            )}
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-8 h-8 rounded-full bg-primary animate-pulse mx-auto" />
            <p className="text-lg text-muted-foreground">Čekáme na výsledky...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-card border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          {questionIndex + 1} / {totalQuestions}
        </span>
        <span className={`text-2xl font-bold font-mono ${countdown <= 5 ? "text-destructive animate-pulse" : "text-primary"}`}>
          {countdown}
        </span>
      </div>

      {/* Question */}
      <div className="px-4 py-6 text-center">
        <h2 className="text-xl md:text-2xl font-heading font-bold text-foreground">
          {question.question}
        </h2>
      </div>

      {/* Answers */}
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
        {question.answers.map((answer, i) => (
          <button
            key={i}
            onClick={() => onAnswer(i)}
            className={`${ANSWER_COLORS[i % 4]} rounded-2xl p-6 flex items-center gap-4 transition-transform active:scale-95 min-h-[80px]`}
          >
            <span className="text-2xl text-white/80">{ANSWER_ICONS[i % 4]}</span>
            <span className="text-lg font-semibold text-white text-left">{answer.text}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

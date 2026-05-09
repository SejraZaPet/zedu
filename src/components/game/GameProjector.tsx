import { GameSession, GamePlayer, GameResponse } from "@/lib/game-types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Trophy, SkipForward } from "lucide-react";
import { useMemo } from "react";
import { t } from "@/lib/t";
import { AvatarSvg } from "@/components/student/AvatarSvg";
import { useStudentAvatars } from "@/hooks/useStudentAvatars";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  responses: GameResponse[];
  countdown: number | null;
  onShowResults: () => void;
  onNext: () => void;
  onEnd: () => void;
}

const ANSWER_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-green-500",
  "bg-yellow-500",
];

const ANSWER_ICONS = ["▲", "◆", "●", "■"];

export const GameProjector = ({ session, players, responses, countdown, onShowResults, onNext, onEnd }: Props) => {
  const qi = session.current_question_index;
  const question = session.activity_data[qi];
  const totalQ = session.activity_data.length;
  const isResults = session.status === "question_results";
  const isLast = qi >= totalQ - 1;

  // Count responses for current question
  const currentResponses = useMemo(
    () => responses.filter((r) => r.question_index === qi),
    [responses, qi]
  );

  const answeredCount = currentResponses.length;
  const correctCount = currentResponses.filter((r) => r.is_correct).length;
  const correctPercent = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

  // Sorted leaderboard
  const leaderboard = useMemo(
    () => [...players].sort((a, b) => b.total_score - a.total_score).slice(0, 5),
    [players]
  );

  const avatars = useStudentAvatars(leaderboard.map((p) => p.user_id));

  if (!question) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-card border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">
          {t("projector.questionOf", qi + 1, totalQ)}
        </span>
        <span className="text-sm text-muted-foreground">
          {answeredCount} / {players.length} odpovědí
        </span>
        {!isResults && countdown !== null && (
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold font-mono ${countdown <= 5 ? "text-destructive animate-pulse" : "text-primary"}`}>
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* Progress */}
      <Progress value={((qi + 1) / totalQ) * 100} className="h-1 rounded-none" />

      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 gap-8">
        {/* Question */}
        <h2 className="text-3xl md:text-5xl font-heading font-bold text-foreground text-center max-w-4xl leading-tight">
          {question.question}
        </h2>

        {/* Answers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
          {question.answers.map((answer, i) => {
            const isCorrect = answer.correct;
            let borderClass = "";
            if (isResults) {
              borderClass = isCorrect
                ? "ring-4 ring-green-500 scale-105"
                : "opacity-50";
            }
            return (
              <div
                key={i}
                className={`${ANSWER_COLORS[i % 4]} rounded-2xl p-6 flex items-center gap-4 transition-all duration-300 ${borderClass}`}
              >
                <span className="text-3xl text-white/80">{ANSWER_ICONS[i % 4]}</span>
                <span className="text-xl md:text-2xl font-semibold text-white">{answer.text}</span>
              </div>
            );
          })}
        </div>

        {/* Results overlay */}
        {isResults && (
          <div className="w-full max-w-4xl space-y-6 animate-fade-in">
            {/* Stats */}
            <div className="flex items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-4xl font-bold text-green-500">{correctPercent}%</p>
                <p className="text-sm text-muted-foreground">správně</p>
              </div>
            </div>

            {/* Leaderboard */}
            {session.settings?.showLeaderboardAfterEach && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Trophy className="w-5 h-5 text-primary" />
                  <h3 className="font-heading font-bold text-lg text-foreground">{t("projector.leaderboard")}</h3>
                </div>
                <div className="space-y-2">
                  {leaderboard.map((player, i) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-4 py-2 px-3 rounded-lg bg-muted/30"
                    >
                      <span className={`text-xl font-bold ${i === 0 ? "text-yellow-500" : i === 1 ? "text-gray-400" : i === 2 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {i + 1}.
                      </span>
                      <span className="flex-1 font-medium text-foreground">{player.nickname}</span>
                      <span className="font-mono font-bold text-primary">{player.total_score}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4">
              <Button onClick={onNext} size="lg" variant="hero" className="gap-2 text-lg px-8">
                {isLast ? (
                  <>
                    <Trophy className="w-5 h-5" />
                    {t("projector.finalResults")}
                  </>
                ) : (
                  <>
                    <ArrowRight className="w-5 h-5" />
                    {t("teacher.buttons.nextQuestion")}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Force show results button (when playing and timer still running) */}
        {!isResults && (
          <Button onClick={onShowResults} variant="outline" size="sm" className="gap-2">
            <SkipForward className="w-4 h-4" />
            {t("teacher.buttons.showLeaderboard")}
          </Button>
        )}
      </div>
    </div>
  );
};

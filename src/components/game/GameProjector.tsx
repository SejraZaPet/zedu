import { GameSession, GamePlayer, GameResponse, computeTeamLeaderboard } from "@/lib/game-types";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Trophy, SkipForward, Users } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { t } from "@/lib/t";
import { AvatarSvg } from "@/components/student/AvatarSvg";
import { useStudentAvatars } from "@/hooks/useStudentAvatars";
import { GameModeOverlay } from "@/components/game/GameModeOverlay";
import { getVisualTheme, playRecipe } from "@/lib/game-themes";
import { cn } from "@/lib/utils";

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

export const GameProjector = ({ session, players, responses, countdown, onShowResults, onNext, onEnd }: Props) => {
  const theme = getVisualTheme((session.settings as any)?.visualTheme);
  const soundsEnabled = (session.settings as any)?.soundsEnabled !== false;
  const ANSWER_ICONS = theme.answerIcons;
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

  // Play themed sounds for new responses on current question
  const lastPlayedRef = useRef(0);
  useEffect(() => {
    if (!soundsEnabled || !theme.sounds) {
      lastPlayedRef.current = currentResponses.length;
      return;
    }
    if (currentResponses.length > lastPlayedRef.current) {
      const last = currentResponses[currentResponses.length - 1];
      playRecipe(last.is_correct ? theme.sounds.correct : theme.sounds.wrong);
    }
    lastPlayedRef.current = currentResponses.length;
  }, [currentResponses, soundsEnabled, theme]);

  useEffect(() => {
    lastPlayedRef.current = 0;
  }, [qi]);

  if (!question) return null;

  const isThemed = theme.id !== "default";

  return (
    <div
      className={cn("min-h-screen flex flex-col relative overflow-hidden", theme.bgClass)}
      style={theme.cssVars as React.CSSProperties}
    >
      {isThemed && theme.decorEmoji && (
        <div className="pointer-events-none absolute inset-0 opacity-10 select-none">
          {theme.decorEmoji.map((e, i) => (
            <span
              key={i}
              className="absolute text-6xl md:text-8xl"
              style={{
                top: `${(i * 37) % 90}%`,
                left: `${(i * 53) % 90}%`,
                transform: `rotate(${(i * 17) % 40 - 20}deg)`,
              }}
            >
              {e}
            </span>
          ))}
        </div>
      )}
      <div className={cn("relative z-10 flex-1 flex flex-col", isThemed && "[&_.bg-card]:bg-card/80 [&_.bg-card]:backdrop-blur-sm")}>
      {/* Top bar */}
      <div className={cn("flex items-center justify-between px-6 py-3 border-b", isThemed ? "bg-black/30 border-white/10 text-white" : "bg-card border-border")}>
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

      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-12 gap-6">
        {/* Live mode visual (race / tower / steal) */}
        {(session.settings as any)?.gameMode && (session.settings as any).gameMode !== "standard" && (
          <div className="w-full max-w-4xl">
            <GameModeOverlay session={session} players={players} />
          </div>
        )}

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

            {/* Leaderboard – use mode overlay for non-standard, classic list for standard */}
            {session.settings?.showLeaderboardAfterEach && (
              (session.settings as any)?.gameMode && (session.settings as any).gameMode !== "standard" ? (
                <GameModeOverlay session={session} players={players} />
              ) : (
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
                        <AvatarSvg slug={player.user_id ? avatars[player.user_id] : undefined} size={32} />
                        <span className="flex-1 font-medium text-foreground">{player.nickname}</span>
                        <span className="font-mono font-bold text-primary">{player.total_score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
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
    </div>
  );
};

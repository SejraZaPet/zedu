import { GameSession, GamePlayer, GameResponse } from "@/lib/game-types";
import { useMemo } from "react";
import { Trophy, Star, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  responses: GameResponse[];
  highlightPlayerId?: string;
}

const PODIUM_STYLES = [
  { emoji: "🥇", size: "text-6xl", bg: "bg-yellow-500/10 border-yellow-500/40", nameSize: "text-2xl" },
  { emoji: "🥈", size: "text-5xl", bg: "bg-gray-400/10 border-gray-400/40", nameSize: "text-xl" },
  { emoji: "🥉", size: "text-4xl", bg: "bg-amber-600/10 border-amber-600/40", nameSize: "text-lg" },
];

export const GameLeaderboardFinal = ({ session, players, responses, highlightPlayerId }: Props) => {
  const navigate = useNavigate();

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => b.total_score - a.total_score),
    [players]
  );

  const totalQuestions = session.activity_data.length;
  const totalCorrect = responses.filter((r) => r.is_correct).length;
  const totalAnswers = responses.length;
  const classAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  const top3 = sortedPlayers.slice(0, 3);
  const rest = sortedPlayers.slice(3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-2xl space-y-8">
        {/* Title */}
        <div className="text-center space-y-2 animate-fade-in">
          <Trophy className="w-12 h-12 text-yellow-500 mx-auto" />
          <h1 className="text-3xl md:text-4xl font-heading font-bold text-foreground">
            Výsledky hry
          </h1>
          <p className="text-muted-foreground">{session.title}</p>
        </div>

        {/* Podium */}
        <div className="flex items-end justify-center gap-4 pt-4">
          {[1, 0, 2].map((podiumIndex) => {
            const player = top3[podiumIndex];
            if (!player) return <div key={podiumIndex} className="w-1/3" />;
            const style = PODIUM_STYLES[podiumIndex];
            const isHighlighted = player.id === highlightPlayerId;
            return (
              <div
                key={player.id}
                className={`flex-1 text-center space-y-2 animate-scale-in ${podiumIndex === 0 ? "order-2" : podiumIndex === 1 ? "order-1" : "order-3"}`}
                style={{ animationDelay: `${podiumIndex * 0.2}s` }}
              >
                <span className={style.size}>{style.emoji}</span>
                <div className={`rounded-2xl border-2 p-4 ${style.bg} ${isHighlighted ? "ring-2 ring-primary" : ""}`}>
                  <p className={`font-heading font-bold text-foreground ${style.nameSize} truncate`}>
                    {player.nickname}
                  </p>
                  <p className="text-lg font-mono font-bold text-primary">{player.total_score} b.</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rest of players */}
        {rest.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
            {rest.map((player, i) => (
              <div
                key={player.id}
                className={`flex items-center gap-3 py-2 px-3 rounded-lg ${player.id === highlightPlayerId ? "bg-primary/10" : "hover:bg-muted/30"}`}
              >
                <span className="text-sm font-bold text-muted-foreground w-6">{i + 4}.</span>
                <span className="flex-1 font-medium text-foreground">{player.nickname}</span>
                <span className="font-mono font-bold text-primary text-sm">{player.total_score} b.</span>
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-primary">{totalQuestions}</p>
            <p className="text-sm text-muted-foreground">otázek</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-500">{classAccuracy}%</p>
            <p className="text-sm text-muted-foreground">úspěšnost třídy</p>
          </div>
        </div>

        {/* Back button */}
        <div className="text-center">
          <Button onClick={() => navigate("/")} variant="outline" className="gap-2">
            <Home className="w-4 h-4" />
            Zpět na hlavní stránku
          </Button>
        </div>
      </div>
    </div>
  );
};

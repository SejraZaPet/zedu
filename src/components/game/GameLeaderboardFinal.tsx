import { GameSession, GamePlayer, GameResponse, computeTeamLeaderboard } from "@/lib/game-types";
import { useMemo } from "react";
import { Trophy, Home, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import GameAvatarFigure from "@/components/game/GameAvatarFigure";
import Confetti from "@/components/game/Confetti";


interface Props {
  session: GameSession;
  players: GamePlayer[];
  responses: GameResponse[];
  highlightPlayerId?: string;
}

// Podium slot styles keyed by rank (0 = 1st, 1 = 2nd, 2 = 3rd).
const PODIUM_SLOTS = [
  { label: "1", medal: "🥇", height: 160, blockColor: "hsl(var(--primary))", nameSize: "text-xl md:text-2xl" },
  { label: "2", medal: "🥈", height: 120, blockColor: "hsl(var(--brand-turquoise))", nameSize: "text-lg md:text-xl" },
  { label: "3", medal: "🥉", height: 90, blockColor: "hsl(var(--brand-purple))", nameSize: "text-base md:text-lg" },
];

export const GameLeaderboardFinal = ({ session, players, responses, highlightPlayerId }: Props) => {
  const navigate = useNavigate();

  const isRaceMode = (session.settings as any)?.gameMode === "race";
  const sortedPlayers = useMemo(() => {
    if (isRaceMode) {
      // In race mode, farthest on the track wins; total_score is tiebreaker.
      return [...players].sort((a, b) => {
        const ai = typeof a.student_index === "number" ? a.student_index : 0;
        const bi = typeof b.student_index === "number" ? b.student_index : 0;
        if (bi !== ai) return bi - ai;
        return (b.total_score || 0) - (a.total_score || 0);
      });
    }
    return [...players].sort((a, b) => b.total_score - a.total_score);
  }, [players, isRaceMode]);



  const totalQuestions = session.activity_data.length;
  const totalCorrect = responses.filter((r) => r.is_correct).length;
  const totalAnswers = responses.length;
  const classAccuracy = totalAnswers > 0 ? Math.round((totalCorrect / totalAnswers) * 100) : 0;

  const top3 = sortedPlayers.slice(0, 3);
  const rest = sortedPlayers.slice(3);

  const teamMode = (session.settings?.teamModeKind ?? "none") !== "none";
  const teamLeaderboard = useMemo(
    () => computeTeamLeaderboard(session.teams?.teams, players),
    [session.teams, players]
  );

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

        {/* Team results (when team mode) */}
        {teamMode && teamLeaderboard.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <h2 className="font-heading font-bold text-lg">Týmové pořadí</h2>
            </div>
            {teamLeaderboard.map((row, i) => (
              <div
                key={row.team.id}
                className="flex items-center gap-3 p-3 rounded-lg border-2"
                style={{ borderColor: row.team.color, background: `${row.team.color}1A` }}
              >
                <span className="text-2xl">{i === 0 ? "🏆" : `${i + 1}.`}</span>
                <span className="flex-1 font-heading font-bold text-lg" style={{ color: row.team.color }}>
                  {row.team.name}
                </span>
                <span className="text-xs text-muted-foreground">{row.memberCount} hráčů</span>
                <span className="font-mono font-bold text-xl">{row.score} b.</span>
              </div>
            ))}
          </div>
        )}

        {/* Podium — full-body avatars standing on colored blocks with confetti */}
        <div className="relative">
          <Confetti count={70} />
          <div className="relative flex items-end justify-center gap-3 md:gap-6 pt-6 pb-2 min-h-[280px]">
            {[1, 0, 2].map((rank) => {
              const player = top3[rank];
              const slot = PODIUM_SLOTS[rank];
              const order = rank === 0 ? "order-2" : rank === 1 ? "order-1" : "order-3";
              if (!player) {
                return <div key={`empty-${rank}`} className={`flex-1 ${order}`} />;
              }
              const isHighlighted = player.id === highlightPlayerId;
              return (
                <div
                  key={player.id}
                  className={`flex-1 flex flex-col items-center animate-scale-in ${order}`}
                  style={{ animationDelay: `${rank * 0.2}s` }}
                >
                  {/* Full-body avatar */}
                  <div className={isHighlighted ? "drop-shadow-[0_0_16px_hsl(var(--primary)/0.6)]" : ""}>
                    <GameAvatarFigure
                      userId={player.user_id}
                      size={rank === 0 ? 140 : 108}
                      crop="full"
                      idleBounce
                      idleDelaySec={rank * 0.4}
                    />
                  </div>
                  {/* Podium block */}
                  <div
                    className="w-full rounded-t-xl border-2 border-b-0 border-white/20 flex flex-col items-center justify-start pt-2 text-white shadow-lg"
                    style={{
                      height: slot.height,
                      background: `linear-gradient(180deg, ${slot.blockColor}, ${slot.blockColor}CC)`,
                    }}
                  >
                    <span className="text-2xl md:text-3xl" aria-hidden>{slot.medal}</span>
                    <span className="text-3xl md:text-4xl font-heading font-black leading-none">{slot.label}</span>
                    <p className={`mt-1 px-1 font-heading font-bold ${slot.nameSize} truncate max-w-full`}>
                      {player.nickname}
                    </p>
                    <p className="text-sm md:text-base font-mono font-bold opacity-90">{player.total_score} b.</p>
                  </div>
                </div>
              );
            })}
          </div>
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
                <GameAvatarFigure userId={player.user_id} size={32} crop="head" />
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

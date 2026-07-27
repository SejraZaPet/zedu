import { useMemo } from "react";
import type { GamePlayer, GameSession } from "@/lib/game-types";
import GameAvatarFigure from "@/components/game/GameAvatarFigure";
import { Flag } from "lucide-react";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  /** Compact mode uses a smaller row height & avatar size. */
  compact?: boolean;
  className?: string;
}

const LANE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--secondary))",
  "hsl(var(--brand-purple))",
  "hsl(var(--brand-turquoise))",
  "#F59E0B",
  "#EF4444",
  "#10B981",
  "#EC4899",
];

/**
 * Horizontal race-track visualisation for live quizzes:
 * every player has a lane; avatar position on the lane = score / maxScore.
 * Position transitions smoothly whenever scores update.
 */
export default function RaceTrack({ session, players, compact = false, className = "" }: Props) {
  const totalQuestions = (session.activity_data as any[])?.length ?? 0;
  // Roughly 1000 points max per question (see calculateScore); use it as ceiling.
  const maxScore = Math.max(1, totalQuestions * 1000);

  const sorted = useMemo(
    () => [...players].sort((a, b) => b.total_score - a.total_score),
    [players]
  );

  const laneH = compact ? 44 : 64;
  const avatarSize = compact ? 40 : 56;

  return (
    <div className={`w-full rounded-2xl bg-black/30 border border-white/10 p-3 md:p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2 text-white/80 text-xs md:text-sm">
        <span className="font-semibold uppercase tracking-wider">Závodní dráha</span>
        <span className="tabular-nums">{players.length} hráčů</span>
      </div>
      <div className="relative">
        {sorted.map((player, idx) => {
          const laneColor = LANE_COLORS[idx % LANE_COLORS.length];
          const ratio = Math.max(0, Math.min(1, player.total_score / maxScore));
          return (
            <div
              key={player.id}
              className="relative"
              style={{ height: laneH, marginBottom: 6 }}
            >
              {/* Lane */}
              <div
                className="absolute inset-y-0 left-0 right-0 rounded-full"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 12px, rgba(255,255,255,0.02) 12px 24px)",
                  border: `1px solid ${laneColor}40`,
                }}
              />
              {/* Finish flag */}
              <Flag
                className="absolute top-1/2 -translate-y-1/2 text-white/70"
                style={{ right: 8, width: compact ? 16 : 20, height: compact ? 16 : 20 }}
                aria-hidden
              />
              {/* Player label */}
              <div
                className="absolute top-1/2 -translate-y-1/2 z-10 text-xs md:text-sm font-medium text-white whitespace-nowrap pointer-events-none"
                style={{ left: 12 }}
              >
                <span className="opacity-80">{idx + 1}.</span>{" "}
                <span>{player.nickname}</span>{" "}
                <span className="tabular-nums opacity-70">{player.total_score}</span>
              </div>
              {/* Avatar racer */}
              <div
                className="absolute top-1/2 -translate-y-1/2 z-20"
                style={{
                  left: `calc(${ratio * 100}% - ${avatarSize / 2}px)`,
                  transition: "left 900ms cubic-bezier(.2,.7,.3,1)",
                }}
              >
                <div
                  className="rounded-2xl ring-2"
                  style={{
                    boxShadow: `0 4px 16px ${laneColor}60`,
                    // ring color via boxShadow inset alt: use border on inner
                  }}
                >
                  <GameAvatarFigure
                    userId={player.user_id}
                    size={avatarSize}
                    crop="head"
                    idleBounce
                    idleDelaySec={(idx % 5) * 0.37}
                  />
                </div>
              </div>
            </div>
          );
        })}
        {players.length === 0 && (
          <p className="text-center text-white/60 text-sm py-6">Zatím žádní hráči</p>
        )}
      </div>
    </div>
  );
}

import { useMemo } from "react";
import type { GamePlayer, GameSession } from "@/lib/game-types";
import { findPlayerTeam } from "@/lib/game-types";
import GameAvatarFigure from "@/components/game/GameAvatarFigure";
import { Flag, Clock } from "lucide-react";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  /** Compact mode uses a smaller row height & avatar size. */
  compact?: boolean;
  /**
   * Positioning strategy:
   * - "score": lane position = total_score / maxScore  (classic quiz)
   * - "progress": lane position = student_index / totalQuestions  (Time-to-Climb race)
   */
  mode?: "score" | "progress";
  /** Remaining race seconds; when provided, renders a big countdown badge. */
  remainingSec?: number | null;
  /** Highlight one player's lane (own view on student device). */
  highlightPlayerId?: string;
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

function formatMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Horizontal race-track visualisation for live quizzes.
 * mode="score": position by total_score. mode="progress": position by student_index.
 */
export default function RaceTrack({
  session,
  players,
  compact = false,
  mode = "score",
  remainingSec = null,
  highlightPlayerId,
  className = "",
}: Props) {
  const totalQuestions = (session.activity_data as any[])?.length ?? 0;
  const maxScore = Math.max(1, totalQuestions * 1000);

  const sorted = useMemo(() => {
    if (mode === "progress") {
      return [...players].sort((a, b) => {
        const ai = typeof a.student_index === "number" ? a.student_index : 0;
        const bi = typeof b.student_index === "number" ? b.student_index : 0;
        if (bi !== ai) return bi - ai;
        return (b.total_score || 0) - (a.total_score || 0);
      });
    }
    return [...players].sort((a, b) => b.total_score - a.total_score);
  }, [players, mode]);

  const laneH = compact ? 44 : 64;
  const avatarSize = compact ? 40 : 56;

  const lowTime = remainingSec !== null && remainingSec !== undefined && remainingSec <= 15;

  return (
    <div className={`w-full rounded-2xl bg-black/30 border border-white/10 p-3 md:p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2 text-white/80 text-xs md:text-sm gap-3">
        <span className="font-semibold uppercase tracking-wider">
          {mode === "progress" ? "Závod – kdo je nejdál" : "Závodní dráha"}
        </span>
        <div className="flex items-center gap-3">
          {remainingSec !== null && remainingSec !== undefined && (
            <span
              className={`inline-flex items-center gap-1.5 tabular-nums font-mono font-bold ${
                lowTime ? "text-red-400 animate-pulse text-base md:text-lg" : "text-white text-sm md:text-base"
              }`}
              aria-label={`Zbývá ${formatMmSs(remainingSec)}`}
            >
              <Clock className="w-4 h-4" />
              {formatMmSs(remainingSec)}
            </span>
          )}
          <span className="tabular-nums">{players.length} hráčů</span>
        </div>
      </div>
      <div className="relative">
        {sorted.map((player, idx) => {
          const laneColor = LANE_COLORS[idx % LANE_COLORS.length];
          let ratio: number;
          if (mode === "progress") {
            const si = typeof player.student_index === "number" ? player.student_index : 0;
            ratio = totalQuestions > 0 ? si / totalQuestions : 0;
          } else {
            ratio = player.total_score / maxScore;
          }
          ratio = Math.max(0, Math.min(1, ratio));

          const isSelf = highlightPlayerId && player.id === highlightPlayerId;

          return (
            <div key={player.id} className="relative" style={{ height: laneH, marginBottom: 6 }}>
              {/* Lane */}
              <div
                className="absolute inset-y-0 left-0 right-0 rounded-full"
                style={{
                  background:
                    "repeating-linear-gradient(90deg, rgba(255,255,255,0.06) 0 12px, rgba(255,255,255,0.02) 12px 24px)",
                  border: `${isSelf ? "2px" : "1px"} solid ${laneColor}${isSelf ? "CC" : "40"}`,
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
                {mode === "progress" ? (
                  <span className="tabular-nums opacity-70">
                    {Math.min(totalQuestions, (player.student_index ?? 0))}/{totalQuestions}
                  </span>
                ) : (
                  <span className="tabular-nums opacity-70">{player.total_score}</span>
                )}
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
                  style={{ boxShadow: `0 4px 16px ${laneColor}60` }}
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

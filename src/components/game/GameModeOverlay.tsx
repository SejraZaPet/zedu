import { useMemo } from "react";
import type { GamePlayer, GameSession, Team } from "@/lib/game-types";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";

import { getModeDef, getThemeDef, type GameMode } from "@/lib/game-modes";
import { resolveGameMode } from "@/lib/game-slide-settings";
import { Trophy, Flag, Skull } from "lucide-react";

interface Props {
  session: GameSession;
  players: GamePlayer[];
  /** Current slide — its `gameSettings` override the session-wide mode. */
  slide?: any;
}

const RACE_BG: Record<string, string> = {
  f1: "linear-gradient(180deg, #1e293b 0%, #0f172a 100%)",
  forest: "linear-gradient(180deg, #14532d 0%, #052e16 100%)",
  space: "linear-gradient(180deg, #1e1b4b 0%, #020617 100%)",
};

const TOWER_BLOCK: Record<string, string[]> = {
  bricks: ["#b45309", "#d97706", "#f59e0b"],
  lego: ["#2563eb", "#dc2626", "#16a34a", "#facc15"],
  candy: ["#ec4899", "#f97316", "#a855f7", "#22c55e"],
};

const STEAL_BG: Record<string, string> = {
  pirate: "linear-gradient(180deg, #422006 0%, #1c1917 100%)",
  thief: "linear-gradient(180deg, #1f2937 0%, #0f172a 100%)",
};

export const GameModeOverlay = ({ session, players, slide }: Props) => {
  const settings = (session.settings as any) || {};
  const mode = resolveGameMode(settings, slide) as GameMode;
  const themeId = settings.theme as string | undefined;
  const modeDef = getModeDef(mode);
  const themeDef = getThemeDef(mode, themeId);

  const sorted = useMemo(
    () => [...players].sort((a, b) => b.total_score - a.total_score),
    [players],
  );


  if (mode === "standard" || players.length === 0) return null;

  if (mode === "race") {
    const maxScore = Math.max(10, ...players.map((p) => p.total_score));
    return (
      <div
        className="rounded-2xl p-5 text-white shadow-lg"
        style={{ background: RACE_BG[themeId || "f1"] || RACE_BG.f1 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <span className="text-2xl">{themeDef.emoji}</span> Závod
          </h3>
          <span className="text-xs opacity-70">+10 bodů pro prvního správného</span>
        </div>
        <div className="space-y-2">
          {sorted.slice(0, 8).map((p) => {
            const pct = Math.min(100, (p.total_score / maxScore) * 100);
            return (
              <div key={p.id} className="relative">
                <div
                  className="h-10 rounded-lg relative overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  {/* Track stripes */}
                  <div
                    className="absolute inset-y-0 left-0 right-8 opacity-20"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(90deg, transparent 0 16px, rgba(255,255,255,0.4) 16px 18px)",
                    }}
                  />
                  {/* Finish flag */}
                  <Flag className="absolute right-1.5 top-1/2 -translate-y-1/2 w-5 h-5 text-yellow-300" />
                  {/* Runner */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
                    style={{ left: `calc(${pct}% - 16px)` }}
                  >
                    <ProfileAvatarBubble userId={p.user_id ?? null} size={32} editable={false} crop="head" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs mt-1 px-1">
                  <span className="opacity-90 truncate max-w-[60%]">{p.nickname}</span>
                  <span className="font-mono font-bold">{p.total_score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (mode === "tower") {
    const colors = TOWER_BLOCK[themeId || "bricks"] || TOWER_BLOCK.bricks;
    const teamsArr = (session as any)?.teams?.teams as Team[] | undefined;
    const teamModeActive = (settings.teamModeKind ?? "none") !== "none";

    // Team mode: aggregate per team; otherwise per player.
    type Column = { id: string; label: string; count: number; color?: string; userId?: string | null };
    let columns: Column[];
    if (teamModeActive && teamsArr && teamsArr.length > 0) {
      const byPlayer = new Map(players.map((p) => [p.id, p.total_score]));
      columns = teamsArr
        .map((t) => ({
          id: t.id,
          label: t.name,
          count: t.members.reduce((sum, pid) => sum + (byPlayer.get(pid) || 0), 0),
          color: t.color,
        }))
        .sort((a, b) => b.count - a.count);
    } else {
      columns = sorted.slice(0, 8).map((p) => ({
        id: p.id,
        label: p.nickname,
        count: p.total_score,
        userId: p.user_id ?? null,
      }));
    }

    const maxBlocks = Math.max(5, ...columns.map((c) => c.count));
    return (
      <div className="rounded-2xl p-5 bg-gradient-to-b from-sky-100 to-sky-50 dark:from-slate-800 dark:to-slate-900 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2 text-foreground">
            <span className="text-2xl">{themeDef.emoji}</span> Stavění věže
            {teamModeActive && <span className="text-xs font-normal text-muted-foreground ml-1">(týmy)</span>}
          </h3>
          <span className="text-xs text-muted-foreground">+1 kostka za správnou odpověď</span>
        </div>
        <div
          className="flex gap-3 items-end overflow-x-auto pb-2"
          style={{ minHeight: `${Math.min(360, maxBlocks * 18 + 60)}px` }}
        >
          {columns.map((col) => {
            const blocks = col.count;
            const paletteColors = col.color ? [col.color] : colors;
            return (
              <div key={col.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 min-w-[72px]">
                <div className="flex flex-col-reverse gap-0.5 items-center">
                  {Array.from({ length: blocks }).map((_, i) => (
                    <div
                      key={i}
                      className="w-12 h-4 rounded-sm shadow-sm transition-all"
                      style={{
                        background: paletteColors[i % paletteColors.length],
                        animation: i === blocks - 1 ? "scale-in 0.3s ease-out" : undefined,
                      }}
                    />
                  ))}
                </div>
                {col.userId !== undefined ? (
                  <ProfileAvatarBubble userId={col.userId ?? null} size={28} editable={false} crop="head" />
                ) : (
                  <div
                    className="w-7 h-7 rounded-full border-2"
                    style={{ borderColor: col.color, background: `${col.color}20` }}
                    aria-hidden
                  />
                )}
                <span
                  className="text-[11px] truncate max-w-[72px] font-medium"
                  style={col.color ? { color: col.color } : { color: "hsl(var(--foreground))" }}
                >
                  {col.label}
                </span>
                <span className="text-xs font-mono font-bold text-primary">{blocks}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }


  if (mode === "steal") {
    return (
      <div
        className="rounded-2xl p-5 text-white shadow-lg"
        style={{ background: STEAL_BG[themeId || "pirate"] || STEAL_BG.pirate }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-heading font-bold text-lg flex items-center gap-2">
            <span className="text-2xl">{themeDef.emoji}</span> Krádež bodů
          </h3>
          <span className="text-xs opacity-70">+5 ukradni soupeři · −3 za chybu</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {sorted.slice(0, 9).map((p, i) => (
            <div
              key={p.id}
              className="rounded-lg p-3 flex items-center gap-2 relative"
              style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              {i === 0 && (
                <Trophy className="absolute top-1 right-1 w-4 h-4 text-yellow-300" />
              )}
              <div className="relative">
                <ProfileAvatarBubble userId={p.user_id ?? null} size={36} editable={false} crop="head" />
                {themeId === "pirate" && (
                  <Skull className="absolute -bottom-1 -right-1 w-4 h-4 text-amber-300 bg-black/60 rounded-full p-0.5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs truncate">{p.nickname}</div>
                <div className="text-base font-bold font-mono flex items-center gap-1">
                  {p.total_score}
                  <span className="text-xs opacity-70">💰</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
};

export default GameModeOverlay;

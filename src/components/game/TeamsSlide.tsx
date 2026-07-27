import { useEffect, useRef } from "react";
import { Users, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  distributeRandomly,
  findPlayerTeam,
  TEAM_COLORS,
  type GamePlayer,
  type GameSession,
  type Team,
} from "@/lib/game-types";
import { TeamSetup } from "./TeamSetup";
import GameAvatarFigure from "./GameAvatarFigure";

type TeamsSpec = {
  teamMode?: "random" | "manual";
  teamCount?: number;
};

function readSpec(slide: any): { mode: "random" | "manual"; count: number } {
  const spec: TeamsSpec = slide?.activitySpec ?? {};
  const mode = spec.teamMode === "manual" ? "manual" : "random";
  const count = Math.max(2, Math.min(6, Number(spec.teamCount) || 2));
  return { mode, count };
}

function ensureTeamsShape(existing: Team[] | undefined, count: number): Team[] {
  if (!existing) return [];
  if (existing.length !== count) return [];
  return existing;
}

/** Teacher-side controls for a "teams" slide. */
export function TeamsSlideTeacher({
  session,
  players,
}: {
  session: GameSession;
  players: GamePlayer[];
}) {
  const currentIndex = session.current_question_index ?? -1;
  const slides = (session.activity_data as any[]) || [];
  const slide = currentIndex >= 0 ? slides[currentIndex] : null;
  const { mode, count } = readSpec(slide);
  const autoDoneRef = useRef(false);

  const shuffle = async () => {
    const next = distributeRandomly(players.map((p) => p.id), count);
    await supabase
      .from("game_sessions")
      .update({ teams: { teams: next } as any })
      .eq("id", session.id);
  };

  // Auto-distribute once on entry when mode is random and teams aren't ready.
  useEffect(() => {
    if (mode !== "random") return;
    if (autoDoneRef.current) return;
    if (players.length === 0) return;
    const teams = ensureTeamsShape(session.teams?.teams, count);
    const assignedCount = teams.reduce((s, t) => s + t.members.length, 0);
    if (teams.length === count && assignedCount >= players.length) return;
    autoDoneRef.current = true;
    void shuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, count, players.length, currentIndex]);

  // Reset auto-flag when slide changes so next teams slide re-shuffles.
  useEffect(() => {
    autoDoneRef.current = false;
  }, [currentIndex]);

  return (
    <div className="mt-3 p-4 border border-border rounded-lg space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Users className="w-4 h-4 text-primary" />
          Rozdělení do skupin ·{" "}
          <span className="text-muted-foreground">
            {mode === "random" ? "náhodně" : "ručně"} · {count} skupin
          </span>
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={shuffle}>
          <Shuffle className="w-4 h-4" />
          {mode === "random" ? "Rozdělit znovu" : "Přeházet náhodně"}
        </Button>
      </div>

      {mode === "manual" && (
        <TeamSetup
          session={
            {
              ...session,
              settings: {
                ...(session.settings as any),
                teamModeKind: "manual",
                teamCount: count,
              },
            } as GameSession
          }
          players={players}
        />
      )}
    </div>
  );
}

/** Fullscreen projector view for a "teams" slide. */
export function TeamsSlideProjector({
  session,
  players,
  slide,
}: {
  session: GameSession;
  players: GamePlayer[];
  slide: any;
}) {
  const { count } = readSpec(slide);
  const teams = ensureTeamsShape(session.teams?.teams, count);
  const headline = slide?.projector?.headline || "Rozdělení do skupin";
  const ready = teams.length === count && teams.some((t) => t.members.length > 0);

  return (
    <div
      className="min-h-screen flex flex-col p-8 md:p-12 gap-8 text-white"
      style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}
    >
      <div className="text-center space-y-2">
        <p className="text-sm md:text-base uppercase tracking-widest text-white/60">
          Skupinová práce
        </p>
        <h1 className="text-4xl md:text-6xl font-bold">{headline}</h1>
      </div>

      {!ready ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-2xl md:text-3xl text-white/70 animate-pulse">
            Čeká se na rozdělení skupin…
          </p>
        </div>
      ) : (
        <div
          className={`flex-1 grid gap-4 md:gap-6 auto-rows-fr`}
          style={{
            gridTemplateColumns: `repeat(${Math.min(count, 3)}, minmax(0, 1fr))`,
          }}
        >
          {teams.map((team) => {
            const members = players.filter((p) => team.members.includes(p.id));
            return (
              <div
                key={team.id}
                className="rounded-2xl bg-white/5 border-2 backdrop-blur flex flex-col overflow-hidden"
                style={{ borderColor: team.color }}
              >
                <div
                  className="px-4 py-3 font-bold text-xl md:text-2xl"
                  style={{ backgroundColor: team.color, color: "#0b0b1a" }}
                >
                  {team.name}{" "}
                  <span className="opacity-70 font-normal text-base">
                    ({members.length})
                  </span>
                </div>
                <div className="p-4 flex flex-wrap gap-3 content-start">
                  {members.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-2 bg-white/10 rounded-full pl-1 pr-3 py-1"
                    >
                      <GameAvatarFigure
                        userId={p.user_id}
                        size={40}
                        crop="head"
                      />
                      <span className="text-sm md:text-base font-medium">
                        {p.nickname}
                      </span>
                    </div>
                  ))}
                  {members.length === 0 && (
                    <p className="text-white/50 italic text-sm">
                      Zatím prázdné
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Student-side view for a "teams" slide. */
export function TeamsSlideStudent({
  session,
  playerId,
}: {
  session: GameSession;
  playerId: string | null;
}) {
  const team = playerId ? findPlayerTeam(session.teams?.teams, playerId) : null;

  if (!team) {
    return (
      <div className="mx-3 sm:mx-4 mt-4 rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur p-6 text-center">
        <Users className="w-10 h-10 mx-auto mb-3 text-white/70" />
        <p className="text-lg font-semibold">Čeká se na rozdělení skupin…</p>
        <p className="text-sm text-white/70 mt-1">
          Učitel za chvíli přidělí skupiny.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-3 sm:mx-4 mt-4">
      <div
        className="rounded-3xl p-8 text-center border-4 shadow-2xl"
        style={{
          backgroundColor: team.color,
          borderColor: team.color,
          color: "#0b0b1a",
        }}
      >
        <p className="text-sm md:text-base uppercase tracking-widest opacity-70 mb-2">
          Jsi ve skupině
        </p>
        <p className="text-4xl md:text-5xl font-extrabold">{team.name}</p>
      </div>
    </div>
  );
}

// Kept for potential future use.
export { TEAM_COLORS };

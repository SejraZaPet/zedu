import { useEffect, useRef } from "react";
import { SplitSquareHorizontal, Shuffle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  distributeRandomly,
  findPlayerTeam,
  type GamePlayer,
  type GameSession,
  type Team,
} from "@/lib/game-types";

type DiffTask = { title: string; content: string };
type DiffSpec = {
  tasks?: DiffTask[];
  teamCount?: number;
};

function readSpec(slide: any): { tasks: DiffTask[]; count: number } {
  const spec: DiffSpec = slide?.activitySpec ?? {};
  const tasks = Array.isArray(spec.tasks) ? spec.tasks : [];
  const count = Math.max(2, Math.min(6, Number(spec.teamCount) || tasks.length || 2));
  return { tasks, count };
}

function ensureTeamsShape(existing: Team[] | undefined, count: number): Team[] {
  if (!existing) return [];
  if (existing.length !== count) return [];
  return existing;
}

/** Teacher-side controls for a "differentiated" slide. */
export function DifferentiatedSlideTeacher({
  session,
  players,
}: {
  session: GameSession;
  players: GamePlayer[];
}) {
  const currentIndex = session.current_question_index ?? -1;
  const slides = (session.activity_data as any[]) || [];
  const slide = currentIndex >= 0 ? slides[currentIndex] : null;
  const { tasks, count } = readSpec(slide);
  const teams = ensureTeamsShape(session.teams?.teams, count);
  const autoDoneRef = useRef(false);

  const shuffle = async () => {
    const next = distributeRandomly(players.map((p) => p.id), count);
    await supabase
      .from("game_sessions")
      .update({ teams: { teams: next } as any })
      .eq("id", session.id);
  };

  // Auto-distribute once on entry if teams aren't yet ready and we have players.
  useEffect(() => {
    if (autoDoneRef.current) return;
    if (players.length === 0) return;
    const assignedCount = teams.reduce((s, t) => s + t.members.length, 0);
    if (teams.length === count && assignedCount >= players.length) return;
    autoDoneRef.current = true;
    void shuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, players.length, currentIndex, teams.length]);

  useEffect(() => {
    autoDoneRef.current = false;
  }, [currentIndex]);

  return (
    <div className="mt-3 p-4 border border-border rounded-lg space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <SplitSquareHorizontal className="w-4 h-4 text-primary" />
          Diferencovaná aktivita ·{" "}
          <span className="text-muted-foreground">{count} skupin · {tasks.length} úkolů</span>
        </p>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={shuffle}>
          <Shuffle className="w-4 h-4" />
          Rozdělit znovu
        </Button>
      </div>

      <div className="grid gap-2">
        {tasks.map((task, i) => {
          const team = teams[i];
          const members = team ? players.filter((p) => team.members.includes(p.id)) : [];
          return (
            <div
              key={i}
              className="rounded-md border p-3 space-y-1.5"
              style={{ borderColor: team?.color ?? "hsl(var(--border))" }}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: team?.color }}>
                  {team?.name || `Skupina ${i + 1}`}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    ({members.length} {members.length === 1 ? "žák" : "žáků"})
                  </span>
                </p>
              </div>
              <p className="text-sm font-medium">{task.title}</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.content}</p>
              {members.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {members.map((m) => m.nickname).join(", ")}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Fullscreen projector view — team overview, no content. */
export function DifferentiatedSlideProjector({
  session,
  players,
  slide,
}: {
  session: GameSession;
  players: GamePlayer[];
  slide: any;
}) {
  const { tasks, count } = readSpec(slide);
  const teams = ensureTeamsShape(session.teams?.teams, count);
  const headline = slide?.projector?.headline || "Diferencovaná aktivita";
  const ready = teams.length === count && teams.some((t) => t.members.length > 0);

  return (
    <div
      className="min-h-screen flex flex-col p-8 md:p-12 gap-8 text-white"
      style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}
    >
      <div className="text-center space-y-2">
        <p className="text-sm md:text-base uppercase tracking-widest text-white/60">
          Skupinová práce · každá skupina jiný úkol
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
          className="flex-1 grid gap-4 md:gap-6 auto-rows-fr"
          style={{ gridTemplateColumns: `repeat(${Math.min(count, 3)}, minmax(0, 1fr))` }}
        >
          {teams.map((team, i) => {
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
                  {team.name}
                  <span className="opacity-70 font-normal text-base ml-2">
                    ({members.length})
                  </span>
                </div>
                <div className="p-6 flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <Users className="w-12 h-12 opacity-60" />
                  <p className="text-lg md:text-xl font-semibold">
                    Pracuje na svém úkolu
                  </p>
                  <p className="text-sm md:text-base text-white/60">
                    Zadání vidí členové skupiny na svém zařízení
                    {tasks[i]?.title ? ` · #${i + 1}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Student-side view — shows only this student's team's task. */
export function DifferentiatedSlideStudent({
  session,
  playerId,
  slide,
}: {
  session: GameSession;
  playerId: string | null;
  slide: any;
}) {
  const { tasks, count } = readSpec(slide);
  const teams = ensureTeamsShape(session.teams?.teams, count);
  const team = playerId ? findPlayerTeam(teams, playerId) : null;

  if (!team) {
    return (
      <div className="mx-3 sm:mx-4 mt-4 rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur p-6 text-center">
        <Users className="w-10 h-10 mx-auto mb-3 text-white/70" />
        <p className="text-lg font-semibold">Čeká se na rozdělení do skupin…</p>
        <p className="text-sm text-white/70 mt-1">
          Učitel za chvíli přidělí skupiny.
        </p>
      </div>
    );
  }

  const teamIndex = teams.findIndex((t) => t.id === team.id);
  const task = teamIndex >= 0 ? tasks[teamIndex] : undefined;

  return (
    <div className="mx-3 sm:mx-4 mt-4 space-y-3">
      <div
        className="rounded-2xl px-5 py-3 border-2 flex items-center justify-between gap-3"
        style={{ backgroundColor: team.color, borderColor: team.color, color: "#0b0b1a" }}
      >
        <div>
          <p className="text-xs uppercase tracking-widest opacity-70">Tvá skupina</p>
          <p className="text-xl font-extrabold">{team.name}</p>
        </div>
        <SplitSquareHorizontal className="w-6 h-6 opacity-70" />
      </div>

      {task ? (
        <div className="rounded-2xl border-2 border-white/20 bg-white/10 backdrop-blur p-5 space-y-2">
          <p className="text-xs uppercase tracking-widest text-white/60">Váš úkol</p>
          <h3 className="text-xl md:text-2xl font-bold">{task.title}</h3>
          <p className="text-sm md:text-base text-white/90 whitespace-pre-wrap leading-relaxed">
            {task.content}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/20 bg-white/5 p-4 text-center text-white/70">
          Pro tuto skupinu zatím není přiřazen úkol.
        </div>
      )}
    </div>
  );
}

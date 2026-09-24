import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { autoAssignPlayers, buildDefaultTeams, type GamePlayer, type GameSession, type TeamMode } from "@/lib/game-types";

/**
 * Běží u učitele po celou dobu hry: každého nově připojeného žáka zařadí
 * do týmu (podle předem načtené třídy/skupiny, v náhodném režimu do
 * nejmenšího týmu). Funguje v lobby i během hry.
 */
export function useTeamAutoAssign(session: GameSession | null | undefined, players: GamePlayer[]) {
  const busy = useRef(false);
  const kind = ((session?.settings as any)?.teamModeKind ?? "none") as TeamMode;
  const count = Number((session?.settings as any)?.teamCount ?? 2);

  useEffect(() => {
    if (!session || kind === "none" || busy.current) return;
    if (session.status === "finished") return;
    const current = session.teams?.teams ?? [];
    const base = current.length > 0 ? current : buildDefaultTeams(count);
    const next = autoAssignPlayers(base, players, kind) ?? (current.length === 0 ? base : null);
    if (!next) return;
    busy.current = true;
    void supabase
      .from("game_sessions")
      .update({ teams: { ...(session.teams || {}), teams: next } as any })
      .eq("id", session.id)
      .then(() => {
        busy.current = false;
      });
  }, [session, players, kind, count]);
}

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface MyLeagueRow {
  status: string; rank: number | null; is_me: boolean | null; tier: number | null;
  group_size: number | null; week_start: string; xp: number | null;
}

let cache: { uid: string; promise: Promise<MyLeagueRow[] | null> } | null = null;

/** Čte stávající RPC school_league_week() jednou za relaci (sdíleno menu + kartou). null = chyba / neznámo. */
export function useMyLeague(userId: string | null | undefined, enabled = true) {
  const [rows, setRows] = useState<MyLeagueRow[] | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled || !userId) { setRows(undefined); return; }
    if (!cache || cache.uid !== userId) {
      cache = {
        uid: userId,
        promise: Promise.resolve(supabase.rpc("school_league_week" as any))
          .then(({ data, error }) => (error ? null : ((data as MyLeagueRow[]) ?? [])))
          .catch(() => null),
      };
    }
    let alive = true;
    cache.promise.then((r) => { if (alive) setRows(r); });
    return () => { alive = false; };
  }, [userId, enabled]);
  const status = rows ? rows[0]?.status ?? "disabled" : null;
  return { rows, status };
}

/** Položka menu „Liga" se skrývá jen u vypnuté ligy a v demu (a dokud stav není známý). */
export const showLeagueMenu = (status: string | null) => !!status && status !== "disabled" && status !== "demo";

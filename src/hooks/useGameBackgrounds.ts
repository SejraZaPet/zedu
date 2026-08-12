import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameBackground } from "@/lib/game-backgrounds";

/** Načte herní pozadí (výchozí jen aktivní) */
export function useGameBackgrounds(includeInactive = false) {
  const [backgrounds, setBackgrounds] = useState<GameBackground[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("game_backgrounds" as any)
      .select("*")
      .order("category", { ascending: true })
      .order("name", { ascending: true });
    if (!includeInactive) query = query.eq("is_active", true);
    const { data } = await query;
    setBackgrounds(((data as any[]) ?? []) as GameBackground[]);
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    load();
  }, [load]);

  return { backgrounds, loading, reload: load };
}

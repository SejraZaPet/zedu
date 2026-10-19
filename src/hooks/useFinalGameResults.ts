import { useCallback, useEffect, useRef, useState } from "react";
import type { GamePlayer } from "@/lib/game-types";

export function useFinalGameResults(
  sessionId: string | undefined,
  status: string | undefined,
  playerId: string,
  refreshPlayers: () => Promise<GamePlayer[]>,
) {
  const [result, setResult] = useState<{ sessionId: string; state: "loading" | "ready" | "error"; players: GamePlayer[] } | null>(null);
  const requestRef = useRef(0);
  const retry = useCallback(async () => {
    if (!sessionId) return;
    const request = ++requestRef.current;
    setResult({ sessionId, state: "loading", players: [] });
    try {
      const players = await refreshPlayers();
      if (!players.some((player) => player.id === playerId)) throw new Error("Chybí vlastní výsledek.");
      if (request === requestRef.current) setResult({ sessionId, state: "ready", players });
    } catch {
      if (request === requestRef.current) setResult({ sessionId, state: "error", players: [] });
    }
  }, [sessionId, playerId, refreshPlayers]);
  useEffect(() => {
    if (status === "finished") void retry();
    else setResult(null);
    return () => { requestRef.current += 1; };
  }, [status, retry]);
  return { result, retry };
}
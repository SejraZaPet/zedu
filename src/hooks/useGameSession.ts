import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession, GamePlayer, GameResponse, GameSettings } from "@/lib/game-types";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { syncClock, getClockOffset } from "@/lib/clock-sync";

export type ConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";

const MAX_RECONNECT_ATTEMPTS = 8;
const BASE_DELAY_MS = 1000; // 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s

function backoffDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * Math.pow(2, attempt), 128_000);
}

export function useGameSession(sessionId: string | undefined) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [responses, setResponses] = useState<GameResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Full data fetch (used for initial load and resync)
  const fetchData = useCallback(async (resyncClock = false) => {
    if (!sessionId) return;

    // Sync clock on initial load or after reconnect
    if (resyncClock) {
      await syncClock(true);
    }

    const [sessionRes, playersRes, responsesRes] = await Promise.all([
      supabase.from("game_sessions").select("*").eq("id", sessionId).single(),
      supabase.from("game_players").select("*").eq("session_id", sessionId).order("total_score", { ascending: false }),
      supabase.from("game_responses").select("*").eq("session_id", sessionId),
    ]);

    if (!mountedRef.current) return;

    if (sessionRes.data) {
      setSession({
        ...sessionRes.data,
        activity_data: sessionRes.data.activity_data as any,
        settings: sessionRes.data.settings as any,
      } as GameSession);
    }
    if (playersRes.data) setPlayers(playersRes.data as GamePlayer[]);
    if (responsesRes.data) setResponses(responsesRes.data as GameResponse[]);
    setLoading(false);
  }, [sessionId]);

  // Subscribe to realtime with reconnect logic
  const subscribe = useCallback(() => {
    if (!sessionId || !mountedRef.current) return;

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`game-${sessionId}-${Date.now()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new) {
          setSession({
            ...payload.new,
            activity_data: (payload.new as any).activity_data as any,
            settings: (payload.new as any).settings as any,
          } as GameSession);
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_players", filter: `session_id=eq.${sessionId}` }, (payload) => {
        setPlayers((prev) => {
          if (prev.some((p) => p.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as GamePlayer];
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_players", filter: `session_id=eq.${sessionId}` }, (payload) => {
        const updated = payload.new as GamePlayer;
        setPlayers((prev) => {
          const next = prev.map((p) => {
            if (p.id !== updated.id) return p;
            // Only accept if score is >= current (guards against out-of-order events)
            return updated.total_score >= p.total_score ? updated : { ...p, total_score: Math.max(p.total_score, updated.total_score) };
          });
          // Re-sort by authoritative total_score descending
          return next.sort((a, b) => b.total_score - a.total_score);
        });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_responses", filter: `session_id=eq.${sessionId}` }, (payload) => {
        setResponses((prev) => {
          if (prev.some((r) => r.id === (payload.new as any).id)) return prev;
          return [...prev, payload.new as GameResponse];
        });
      })
      .subscribe((status, err) => {
        if (!mountedRef.current) return;

        switch (status) {
          case "SUBSCRIBED":
            setConnectionStatus("connected");
            // Reset reconnect counter on success
            if (reconnectAttemptRef.current > 0) {
              // Resync data + clock after reconnect
              fetchData(true);
            }
            reconnectAttemptRef.current = 0;
            break;

          case "CHANNEL_ERROR":
          case "TIMED_OUT":
            console.warn(`Realtime ${status}:`, err);
            setConnectionStatus("reconnecting");
            scheduleReconnect();
            break;

          case "CLOSED":
            // Only reconnect if still mounted (not intentional cleanup)
            if (mountedRef.current) {
              setConnectionStatus("reconnecting");
              scheduleReconnect();
            }
            break;
        }
      });

    channelRef.current = channel;
  }, [sessionId, fetchData]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionStatus("disconnected");
      return;
    }

    const delay = backoffDelay(reconnectAttemptRef.current);
    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        subscribe();
      }
    }, delay);
  }, [subscribe]);

  // Manual reconnect (exposed for UI retry button)
  const reconnect = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setConnectionStatus("connecting");
    subscribe();
  }, [subscribe]);

  // Initial fetch + subscribe + clock sync
  useEffect(() => {
    mountedRef.current = true;

    syncClock(true).then(() => {
      if (mountedRef.current) fetchData();
    });
    subscribe();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchData, subscribe]);

  return { session, players, responses, loading, connectionStatus, reconnect, setSession, setPlayers };
}

export function useTeacherGameControls(sessionId: string | undefined) {
  const startGame = useCallback(async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      status: "playing",
      current_question_index: 0,
      question_started_at: new Date().toISOString(),
    }).eq("id", sessionId);
  }, [sessionId]);

  const nextQuestion = useCallback(async (currentIndex: number) => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      current_question_index: currentIndex + 1,
      question_started_at: new Date().toISOString(),
      status: "playing",
    }).eq("id", sessionId);
  }, [sessionId]);

  const showResults = useCallback(async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      status: "question_results",
    }).eq("id", sessionId);
  }, [sessionId]);

  const endGame = useCallback(async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      status: "finished",
    }).eq("id", sessionId);
  }, [sessionId]);

  return { startGame, nextQuestion, showResults, endGame };
}

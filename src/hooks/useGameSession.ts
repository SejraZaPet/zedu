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

export function useGameSession(sessionId: string | undefined, refetchTrigger?: number) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [responses, setResponses] = useState<GameResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  const channelRef = useRef<RealtimeChannel | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Full data fetch (used for initial load and resync)
  const fetchData = useCallback(async (resyncClock = false) => {
    if (!sessionId) return;

    // Sync clock on initial load or after reconnect
    if (resyncClock) {
      await syncClock(true);
    }

    const [sessionRes, playersRes, responsesRes] = await Promise.all([
      supabase.from("game_sessions_player_view" as any).select("*").eq("id", sessionId).single(),
      supabase.from("game_players_public").select("*").eq("session_id", sessionId).order("total_score", { ascending: false }),
      supabase.from("game_responses").select("*").eq("session_id", sessionId),
    ]);

    if (!mountedRef.current) return;

    if (sessionRes.data) {
      const row = sessionRes.data as any;
      let activityData: any = (row.activity_data_safe as any) ?? [];

      // If current user is the session owner, fetch unsanitized activity_data
      // (with answers[].correct flags) from the full game_sessions table.
      // RLS allows SELECT to auth.uid() = teacher_id.
      try {
        const { data: userData } = await supabase.auth.getUser();
        const uid = userData?.user?.id;
        if (uid && row.teacher_id && uid === row.teacher_id) {
          const { data: full } = await supabase
            .from("game_sessions")
            .select("activity_data")
            .eq("id", sessionId)
            .single();
          if (full && (full as any).activity_data) {
            activityData = (full as any).activity_data;
          }
        }
      } catch {
        // ignore — fall back to safe view
      }

      if (!mountedRef.current) return;
      setSession({
        ...row,
        activity_data: activityData,
        settings: row.settings as any,
        teams: row.teams ?? { teams: [] },
      } as unknown as GameSession);
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
          // Merge with previous state to guard against partial payloads.
          // IMPORTANT: NEVER copy activity_data from the realtime payload — it contains
          // the unsanitized quiz data (with correct-answer flags). activity_data is sourced
          // exclusively from game_sessions_player_view via fetchData() polling.
          setSession((prev) => {
            const incoming = { ...(payload.new as any) };
            delete incoming.activity_data;
            const merged = { ...(prev as any), ...incoming };
            if (incoming.settings == null && (prev as any)?.settings) merged.settings = (prev as any).settings;
            merged.activity_data = (prev as any)?.activity_data ?? [];
            merged.teams = merged.teams ?? { teams: [] };
            return merged as unknown as GameSession;
          });
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

    // Polling fallback for unauthenticated users (Realtime may 401)
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      if (mountedRef.current) fetchData();
    }, 2000);
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
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [fetchData, subscribe, refetchTrigger]);

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

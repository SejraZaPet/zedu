import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { GameSession, GamePlayer, GameResponse, GameSettings } from "@/lib/game-types";

export function useGameSession(sessionId: string | undefined) {
  const [session, setSession] = useState<GameSession | null>(null);
  const [players, setPlayers] = useState<GamePlayer[]>([]);
  const [responses, setResponses] = useState<GameResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial data
  useEffect(() => {
    if (!sessionId) return;

    const fetchData = async () => {
      const [sessionRes, playersRes, responsesRes] = await Promise.all([
        supabase.from("game_sessions").select("*").eq("id", sessionId).single(),
        supabase.from("game_players").select("*").eq("session_id", sessionId).order("total_score", { ascending: false }),
        supabase.from("game_responses").select("*").eq("session_id", sessionId),
      ]);

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
    };

    fetchData();
  }, [sessionId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`game-${sessionId}`)
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
        setPlayers((prev) => [...prev, payload.new as GamePlayer]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "game_players", filter: `session_id=eq.${sessionId}` }, (payload) => {
        setPlayers((prev) => prev.map((p) => (p.id === (payload.new as any).id ? (payload.new as GamePlayer) : p)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "game_responses", filter: `session_id=eq.${sessionId}` }, (payload) => {
        setResponses((prev) => [...prev, payload.new as GameResponse]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  return { session, players, responses, loading, setSession, setPlayers };
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

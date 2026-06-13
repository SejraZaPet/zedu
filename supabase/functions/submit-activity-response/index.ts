import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const {
      joinToken,
      playerId: rawPlayerId,
      sessionId,
      questionIndex,
      isCorrect,
      score,
      responseTimeMs,
      answer,
    } = body ?? {};

    if (!sessionId || typeof sessionId !== "string") {
      return json({ error: "Missing sessionId" }, 400);
    }
    if (typeof questionIndex !== "number" || questionIndex < 0) {
      return json({ error: "Invalid questionIndex" }, 400);
    }
    if (!joinToken && !rawPlayerId) {
      return json({ error: "Missing joinToken or playerId" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    // Resolve player: prefer joinToken (validated), fallback to playerId (must belong to session)
    let playerId: string | null = null;
    if (joinToken && typeof joinToken === "string") {
      const { data: players, error } = await admin
        .from("game_players")
        .select("id, session_id, token_expires_at")
        .eq("join_token", joinToken)
        .limit(1);
      if (error) throw error;
      if (!players?.length) return json({ error: "Invalid token" }, 401);
      const p = players[0];
      if (p.session_id !== sessionId) return json({ error: "Session mismatch" }, 403);
      if (p.token_expires_at && new Date(p.token_expires_at) < new Date()) {
        return json({ error: "Token expired" }, 401);
      }
      playerId = p.id;
    } else {
      const { data: players, error } = await admin
        .from("game_players")
        .select("id, session_id")
        .eq("id", rawPlayerId)
        .limit(1);
      if (error) throw error;
      if (!players?.length) return json({ error: "Invalid player" }, 401);
      if (players[0].session_id !== sessionId) return json({ error: "Session mismatch" }, 403);
      playerId = players[0].id;
    }

    // Idempotency
    const { data: existing } = await admin
      .from("game_responses")
      .select("id")
      .eq("session_id", sessionId)
      .eq("player_id", playerId)
      .eq("question_index", questionIndex)
      .limit(1);
    if (existing?.length) {
      return json({ success: true, alreadyAnswered: true }, 200);
    }

    const safeScore = typeof score === "number" ? Math.max(-1000, Math.min(1000, Math.round(score))) : 0;
    const safeRt = typeof responseTimeMs === "number" ? Math.max(0, Math.round(responseTimeMs)) : 0;

    const { error: insErr } = await admin.from("game_responses").insert({
      session_id: sessionId,
      player_id: playerId,
      question_index: questionIndex,
      answer: answer ?? {},
      is_correct: !!isCorrect,
      score: safeScore,
      response_time_ms: safeRt,
    });
    if (insErr) throw insErr;

    if (safeScore !== 0) {
      await admin.rpc("increment_player_score", {
        _player_id: playerId,
        _score_delta: safeScore,
      });
    }

    return json({ success: true }, 200);
  } catch (e) {
    console.error("submit-activity-response error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

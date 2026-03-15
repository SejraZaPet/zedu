import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calculateScore(correct: boolean, responseTimeMs: number, timeLimitMs: number): number {
  if (!correct) return 0;
  const ratio = Math.max(0, 1 - responseTimeMs / timeLimitMs);
  return Math.round(400 + 600 * ratio);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { joinToken, answerIndex } = await req.json();

    if (!joinToken || typeof joinToken !== "string") {
      return new Response(JSON.stringify({ error: "Missing join token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof answerIndex !== "number" || answerIndex < 0) {
      return new Response(JSON.stringify({ error: "Invalid answer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRole);

    // Validate token and get player
    const { data: players, error: pErr } = await adminClient
      .from("game_players")
      .select("id, session_id, token_expires_at")
      .eq("join_token", joinToken)
      .limit(1);

    if (pErr) throw pErr;
    if (!players?.length) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const player = players[0];

    // Check token expiry
    if (player.token_expires_at && new Date(player.token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get current session state
    const { data: session, error: sErr } = await adminClient
      .from("game_sessions")
      .select("id, status, current_question_index, question_started_at, activity_data, settings")
      .eq("id", player.session_id)
      .single();

    if (sErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (session.status !== "playing") {
      return new Response(JSON.stringify({ error: "Game not active" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qi = session.current_question_index;

    // Check if already answered
    const { data: existing } = await adminClient
      .from("game_responses")
      .select("id")
      .eq("session_id", session.id)
      .eq("player_id", player.id)
      .eq("question_index", qi)
      .limit(1);

    if (existing?.length) {
      return new Response(JSON.stringify({ error: "Already answered", alreadyAnswered: true }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate answer against server-side data
    const questions = session.activity_data as any[];
    const question = questions[qi];
    if (!question) {
      return new Response(JSON.stringify({ error: "Invalid question" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCorrect = question.answers?.[answerIndex]?.correct || false;
    const settings = session.settings as any;
    const timeLimitMs = (settings?.timePerQuestion || 20) * 1000;
    const elapsed = session.question_started_at
      ? Date.now() - new Date(session.question_started_at).getTime()
      : timeLimitMs;
    const score = calculateScore(isCorrect, elapsed, timeLimitMs);

    // Insert response
    await adminClient.from("game_responses").insert({
      session_id: session.id,
      player_id: player.id,
      question_index: qi,
      answer: { index: answerIndex },
      is_correct: isCorrect,
      response_time_ms: Math.round(elapsed),
      score,
    });

    // Atomic score increment
    await adminClient.rpc("increment_player_score", {
      _player_id: player.id,
      _score_delta: score,
    });

    return new Response(
      JSON.stringify({ correct: isCorrect, score }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("submit-answer error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

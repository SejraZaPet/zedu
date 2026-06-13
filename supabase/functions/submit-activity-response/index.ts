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
      sessionId,
      questionIndex,
      isCorrect,
      score,
      responseTimeMs,
      answer,
      answerData,
    } = body ?? {};
    const answerPayload = answerData ?? answer ?? {};

    if (!sessionId || typeof sessionId !== "string") {
      return json({ error: "Missing sessionId" }, 400);
    }
    if (typeof questionIndex !== "number" || questionIndex < 0) {
      return json({ error: "Invalid questionIndex" }, 400);
    }
    if (!joinToken || typeof joinToken !== "string") {
      return json({ error: "Invalid token" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRole);

    // Resolve player strictly via joinToken (no rawPlayerId fallback).
    const { data: players, error: pErr } = await admin
      .from("game_players")
      .select("id, session_id, token_expires_at")
      .eq("join_token", joinToken)
      .limit(1);
    if (pErr) throw pErr;
    if (!players?.length) return json({ error: "Invalid token" }, 401);
    const p = players[0];
    if (p.session_id !== sessionId) return json({ error: "Invalid token" }, 401);
    if (p.token_expires_at && new Date(p.token_expires_at) < new Date()) {
      return json({ error: "Invalid token" }, 401);
    }
    const playerId = p.id;

    // Load session activity_data to inspect question type
    const { data: sess } = await admin
      .from("game_sessions")
      .select("activity_data")
      .eq("id", sessionId)
      .maybeSingle();
    const activityData = (sess?.activity_data as any[]) || [];
    const question = activityData[questionIndex];

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

    // Determine final isCorrect / score
    let finalIsCorrect = !!isCorrect;
    let finalScore = typeof score === "number" ? score : 0;

    const hasMcqOptions = Array.isArray(question?.activitySpec?.options);
    if (hasMcqOptions) {
      // TODO: client-trusted score for MCQ activity — requires answerData.selectedIndex
      // to verify server-side. Currently QuizActivity (StudentGamePlay.tsx) only
      // submits derived score/maxScore without the selected option index, so we cannot
      // independently recompute correctness here.
    }
    // For Poll/Wall and other types without a definitive "correct" answer,
    // client-supplied isCorrect/score are preserved as-is.

    const safeScore = Math.max(-1000, Math.min(1000, Math.round(finalScore)));
    const safeRt = typeof responseTimeMs === "number" ? Math.max(0, Math.round(responseTimeMs)) : 0;

    const { error: insErr } = await admin.from("game_responses").insert({
      session_id: sessionId,
      player_id: playerId,
      question_index: questionIndex,
      answer: answerPayload,
      is_correct: finalIsCorrect,
      score: safeScore,
      response_time_ms: safeRt,
    });
    if (insErr) throw insErr;

    // NOTE: Intentionally do NOT call increment_player_score here.
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

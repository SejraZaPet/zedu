import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function calculateStandardScore(correct: boolean, responseTimeMs: number, timeLimitMs: number): number {
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof answerIndex !== "number" || answerIndex < 0) {
      return new Response(JSON.stringify({ error: "Invalid answer" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRole);

    const { data: players, error: pErr } = await adminClient
      .from("game_players")
      .select("id, session_id, token_expires_at")
      .eq("join_token", joinToken)
      .limit(1);
    if (pErr) throw pErr;
    if (!players?.length) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const player = players[0];
    if (player.token_expires_at && new Date(player.token_expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "Token expired" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: session, error: sErr } = await adminClient
      .from("game_sessions")
      .select("id, status, current_question_index, question_started_at, activity_data, settings")
      .eq("id", player.session_id)
      .single();
    if (sErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (session.status !== "playing") {
      return new Response(JSON.stringify({ error: "Game not active" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const qi = session.current_question_index;

    const { data: existing } = await adminClient
      .from("game_responses")
      .select("id")
      .eq("session_id", session.id)
      .eq("player_id", player.id)
      .eq("question_index", qi)
      .limit(1);
    if (existing?.length) {
      return new Response(JSON.stringify({ error: "Already answered", alreadyAnswered: true }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questions = session.activity_data as any[];
    const question = questions[qi];
    if (!question) {
      return new Response(JSON.stringify({ error: "Invalid question" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCorrect = question.answers?.[answerIndex]?.correct || false;
    const settings = (session.settings as any) || {};
    const gameMode: string = settings.gameMode || "standard";
    const timeLimitMs = (settings?.timePerQuestion || 20) * 1000;
    const elapsed = session.question_started_at
      ? Date.now() - new Date(session.question_started_at).getTime()
      : timeLimitMs;

    let score = 0;
    let stolenFrom: string | null = null;

    if (gameMode === "race") {
      // First correct gets 10, others 0
      if (isCorrect) {
        const { data: priorCorrect } = await adminClient
          .from("game_responses")
          .select("id")
          .eq("session_id", session.id)
          .eq("question_index", qi)
          .eq("is_correct", true)
          .limit(1);
        score = priorCorrect?.length ? 0 : 10;
      }
    } else if (gameMode === "tower") {
      // 1 block per correct answer
      score = isCorrect ? 1 : 0;
    } else if (gameMode === "steal") {
      if (isCorrect) {
        // Steal 5 from a random opponent
        const { data: opponents } = await adminClient
          .from("game_players")
          .select("id, total_score")
          .eq("session_id", session.id)
          .neq("id", player.id);
        const eligible = (opponents || []).filter((o) => (o.total_score ?? 0) > 0);
        const pool = eligible.length > 0 ? eligible : (opponents || []);
        if (pool.length > 0) {
          const target = pool[Math.floor(Math.random() * pool.length)];
          stolenFrom = target.id;
          await adminClient.rpc("increment_player_score", {
            _player_id: target.id, _score_delta: -5,
          });
          score = 5;
        } else {
          score = 5; // no opponents, just gain
        }
      } else {
        score = -3;
      }
    } else {
      score = calculateStandardScore(isCorrect, elapsed, timeLimitMs);
    }

    await adminClient.from("game_responses").insert({
      session_id: session.id,
      player_id: player.id,
      question_index: qi,
      answer: { index: answerIndex, stolenFrom, gameMode },
      is_correct: isCorrect,
      response_time_ms: Math.round(elapsed),
      score,
    });

    if (score !== 0) {
      await adminClient.rpc("increment_player_score", {
        _player_id: player.id, _score_delta: score,
      });
    }

    return new Response(
      JSON.stringify({ correct: isCorrect, score, stolenFrom }),
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

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
      .select("id, session_id, token_expires_at, student_index")
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
      .select("id, status, current_question_index, question_started_at, activity_data, settings, teams")
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

    const settings = (session.settings as any) || {};
    const gameMode: string = settings.gameMode || "standard";
    const pacingMode: string = settings.pacingMode || "teacher";
    const isStudentPaced = gameMode === "race" || pacingMode === "student";

    // In race / student-paced modes each player is on their own question.
    // Trust the server-side player.student_index (set via set_student_index RPC).
    const qi = isStudentPaced
      ? (typeof (player as any).student_index === "number" ? (player as any).student_index : 0)
      : session.current_question_index;

    const questions = session.activity_data as any[];
    const question = questions[qi];
    if (!question) {
      return new Response(JSON.stringify({ error: "Invalid question" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isCorrect = !!question.answers?.[answerIndex]?.correct;

    // Race mode: on WRONG answer we do NOT insert a response — student
    // stays on the same question and retries. Only correct answers persist.
    if (gameMode === "race" && !isCorrect) {
      return new Response(
        JSON.stringify({ correct: false, score: 0, retry: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency check (applies to all modes except race-wrong which returned above).
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

    const timeLimitMs = (settings?.timePerQuestion || 20) * 1000;
    const elapsed = session.question_started_at
      ? Date.now() - new Date(session.question_started_at).getTime()
      : timeLimitMs;

    let score = 0;
    let stolenFrom: string | null = null;

    if (gameMode === "race") {
      // Time-to-Climb: flat 10 points per correct answer.
      score = 10;
    } else if (gameMode === "tower") {
      score = isCorrect ? 1 : 0;
    } else if (gameMode === "steal") {
      if (isCorrect) {
        const { data: opponents } = await adminClient
          .from("game_players")
          .select("id, total_score, nickname")
          .eq("session_id", session.id)
          .neq("id", player.id);

        // Team-mode: exclude opponents on the attacker's team so a player
        // can't steal from their own teammates.
        const teamModeKind = settings?.teamModeKind ?? "none";
        const teamsArr = ((session as any).teams?.teams ?? []) as Array<{ id: string; members: string[] }>;
        let candidatePool = opponents || [];
        if (teamModeKind !== "none" && teamsArr.length > 0) {
          const myTeam = teamsArr.find((t) => Array.isArray(t.members) && t.members.includes(player.id));
          if (myTeam) {
            const teammateIds = new Set(myTeam.members);
            candidatePool = candidatePool.filter((o) => !teammateIds.has(o.id));
          }
        }

        const eligible = candidatePool.filter((o) => (o.total_score ?? 0) > 0);
        const pool = eligible.length > 0 ? eligible : candidatePool;
        if (pool.length > 0) {
          const target = pool[Math.floor(Math.random() * pool.length)];
          stolenFrom = target.id;
          await adminClient.rpc("increment_player_score", {
            _player_id: target.id, _score_delta: -5,
          });
          score = 5;
          // Include victim nickname in response for student-side feedback.
          (globalThis as any).__stolenNick = (target as any).nickname ?? null;
        } else {
          score = 5;
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
      JSON.stringify({ correct: isCorrect, score, stolenFrom, questionIndex: qi }),
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

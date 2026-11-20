import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { scoreLiveAnswer } from "../_shared/game-scoring-apply.ts";
import { effectiveMode, mcqCorrectFromSelection, slidePointsFactor, soloRoundPoints } from "../_shared/game-scoring.ts";
import { isGradedSlide } from "../_shared/session-participants.ts";
import { isAwaitingStart, resolveTimeLimitSec } from "../_shared/live-timing.ts";
import { evaluateSoloRound, isSoloRoundSlide } from "../_shared/solo-round.ts";

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
      .select("id, session_id, token_expires_at, user_id, student_index")
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
      .select("activity_data, settings, teams, question_started_at, status, current_question_index, updated_at")
      .eq("id", sessionId)
      .maybeSingle();
    const activityData = (sess?.activity_data as any[]) || [];
    const question = activityData[questionIndex];

    // Ruční „Spustit“: na připravený, ale nespuštěný slide se odpovídat nedá.
    if (isAwaitingStart(sess?.settings ?? {}, question, questionIndex)) {
      return json({ error: "Not started", notStarted: true }, 409);
    }

    // Open-ended activities (wordcloud / wall / open question) are explicitly
    // multi-entry: one player may send several words or several notes. Applying
    // the one-response-per-question idempotency there silently dropped every
    // entry after the first, so the projector showed "no responses".
    const activityType = String(question?.activitySpec?.activityType || "");
    const openEnded = ["wordcloud", "wall", "open", "open_question"].includes(activityType);
    const soloRound = isSoloRoundSlide(question);
    if (soloRound) {
      const mode = effectiveMode(sess?.settings?.gameMode, question?.gameSettings?.mode);
      const expectedIndex = mode === "race" ? Number(p.student_index ?? 0) : Number(sess?.current_question_index);
      if (questionIndex !== expectedIndex || !["playing", "question_results"].includes(String(sess?.status))) {
        return json({ error: "Round is not active" }, 409);
      }
      // Po zveřejnění řešení je jen krátká síťová lhůta na automatické odeslání.
      if (sess?.status === "question_results") {
        const closedAt = sess?.updated_at ? new Date(sess.updated_at).getTime() : 0;
        if (!closedAt || Date.now() - closedAt > 10_000) return json({ error: "Round is closed" }, 409);
      }
      if (mode !== "race") {
        const limit = resolveTimeLimitSec(question, sess?.settings, "live");
        const startedAt = sess?.question_started_at ? new Date(sess.question_started_at).getTime() : 0;
        if (limit !== null && startedAt && Date.now() - startedAt > limit * 1000 + 10_000) {
          return json({ error: "Round is closed" }, 409);
        }
      }
    }

    // Idempotency (scored activities only)
    const { data: existing } = openEnded ? { data: null } : await admin
      .from("game_responses")
      .select("id, score, is_correct, answer")
      .eq("session_id", sessionId)
      .eq("player_id", playerId)
      .eq("question_index", questionIndex)
      .limit(1);
    if (existing?.length) {
      const previous = existing[0] as any;
      return json({
        success: true,
        alreadyAnswered: true,
        ...(soloRound ? {
          score: previous.score,
          isCorrect: previous.is_correct,
          correctCount: previous.answer?.correctCount ?? 0,
          totalCount: previous.answer?.totalCount ?? 0,
          gameMode: previous.answer?.gameMode,
          soloRound: true,
        } : {}),
      }, 200);
    }

    // Determine final isCorrect / score
    let finalIsCorrect = !!isCorrect;
    let finalScore = typeof score === "number" ? score : 0;

    // Server rozhoduje: u MCQ ověří správnost ze zvolených indexů a body
    // spočítá podle herního režimu (stejná pravidla jako submit-answer).
    let modeExtras: Record<string, unknown> = {};
    let victimHandled = false;
    let soloEvaluation: ReturnType<typeof evaluateSoloRound> | null = null;
    if (soloRound) {
      const templateId = String(sess?.settings?.sourceTemplateId ?? "");
      if (!templateId) return json({ error: "Solo round source is missing" }, 409);
      const { data: template, error: templateError } = await admin
        .from("teacher_game_templates")
        .select("activity_data")
        .eq("id", templateId)
        .maybeSingle();
      if (templateError) throw templateError;
      const original = ((template?.activity_data as any[]) ?? []).find((slide) => slide?.slideId === question?.slideId);
      if (!original?.activitySpec) return json({ error: "Solo round source is missing" }, 409);
      soloEvaluation = evaluateSoloRound(original.activitySpec, answerPayload);
      const mode = effectiveMode(sess?.settings?.gameMode, question?.gameSettings?.mode);
      finalIsCorrect = soloEvaluation.totalCount > 0 && soloEvaluation.correctCount === soloEvaluation.totalCount;
      finalScore = soloRoundPoints(mode, soloEvaluation, slidePointsFactor(question));
      modeExtras = { gameMode: mode, soloRound: true, correctCount: soloEvaluation.correctCount, totalCount: soloEvaluation.totalCount };
    } else if (!openEnded && question && isGradedSlide(question)) {
      const verified = mcqCorrectFromSelection(question?.activitySpec?.options, answerPayload?.selected);
      if (verified !== null) finalIsCorrect = verified;
      const startedAt = sess?.question_started_at ? new Date(sess.question_started_at).getTime() : null;
      const elapsedMs = startedAt ? Date.now() - startedAt : (typeof responseTimeMs === "number" ? responseTimeMs : 0);
      // Neověřitelné úlohy (hodnocené na zařízení) – správnost zůstává z telefonu.
      const scored = await scoreLiveAnswer(admin, {
        sessionId, settings: sess?.settings ?? {}, teams: (sess as any)?.teams, slide: question,
        playerId, correct: finalIsCorrect, elapsedMs,
      });
      finalScore = scored.score;
      victimHandled = true;
      modeExtras = { gameMode: scored.mode, stolenFrom: scored.victimId, stolenAmount: -scored.victimDelta, robber: scored.robber };
    }

    const safeScore = soloRound
      ? Math.max(0, Math.min(2000, Math.round(finalScore)))
      : Math.max(-1000, Math.min(1000, Math.round(finalScore)));
    const safeRt = typeof responseTimeMs === "number" ? Math.max(0, Math.round(responseTimeMs)) : 0;

    const { error: insErr } = await admin.from("game_responses").insert({
      session_id: sessionId,
      player_id: playerId,
      question_index: questionIndex,
      answer: soloEvaluation
        ? { ...answerPayload, ...modeExtras, itemResults: soloEvaluation.itemResults }
        : victimHandled ? { ...answerPayload, ...modeExtras } : answerPayload,
      is_correct: finalIsCorrect,
      score: safeScore,
      response_time_ms: safeRt,
    });
    if (insErr) throw insErr;

    // Scored activities must also feed the player's running total, otherwise
    // leaderboards / race track stay at zero even when students answer well.
    // Open-ended activities (wall, wordcloud, open) carry no correctness, so they
    // never contribute points.
    if (!openEnded && safeScore !== 0) {
      const { error: incErr } = await admin.rpc("increment_player_score", {
        _player_id: playerId,
        _score_delta: safeScore,
      });
      if (incErr) console.error("increment_player_score failed:", incErr);

      // Long-term gamification: successful live answers also grant XP to the
      // signed-in student (guest players have no user_id and are skipped).
      if (finalIsCorrect && p.user_id) {
        const xp = Math.max(2, Math.min(20, Math.round(safeScore / 100)));
        const { error: xpErr } = await admin.rpc("add_xp", {
          _student: p.user_id,
          _amount: xp,
          _source: "live_game",
          _source_key: `${sessionId}:${questionIndex ?? ""}`,
        });
        if (xpErr) console.error("add_xp failed:", xpErr);
      }
    }

    return json({ success: true, score: safeScore, isCorrect: finalIsCorrect, ...modeExtras }, 200);
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

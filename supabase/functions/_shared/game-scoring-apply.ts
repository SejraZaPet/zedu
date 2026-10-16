// Načte data potřebná pro pravidla v game-scoring.ts a provede krádež.
import {
  computeScore, correctStreak, effectiveMode, pickVictim, stealCandidates, teamsActiveFor,
  type ScoreResult, type GameModeId,
} from "./game-scoring.ts";

export interface ApplyInput {
  sessionId: string;
  settings: any;
  teams: any;
  slide: any;
  playerId: string;
  correct: boolean;
  elapsedMs: number;
}

export async function scoreLiveAnswer(admin: any, i: ApplyInput): Promise<ScoreResult & { mode: GameModeId; victimNickname: string | null }> {
  const mode = effectiveMode(i.settings?.gameMode, i.slide?.gameSettings?.mode);
  const timeLimitMs = (Number(i.slide?.timeLimit) || Number(i.settings?.timePerQuestion) || 20) * 1000;

  let myScore = 0;
  let streak = i.correct ? 1 : 0;
  let victim = null as any;
  if (mode === "steal") {
    const { data: players } = await admin.from("game_players")
      .select("id, total_score, nickname").eq("session_id", i.sessionId);
    const me = (players || []).find((p: any) => p.id === i.playerId);
    myScore = me?.total_score ?? 0;
    const { data: prev } = await admin.from("game_responses")
      .select("is_correct, question_index").eq("session_id", i.sessionId).eq("player_id", i.playerId)
      .order("question_index", { ascending: false }).limit(10);
    streak = correctStreak((prev || []).map((r: any) => !!r.is_correct), i.correct);
    const teams = i.teams?.teams ?? [];
    victim = pickVictim(stealCandidates(i.playerId, players || [], teams, teamsActiveFor(i.slide, i.settings)));
  }

  const res = computeScore({ mode, correct: i.correct, elapsedMs: i.elapsedMs, timeLimitMs, myScore, streak, victim });
  if (res.victimId && res.victimDelta) {
    const { error } = await admin.rpc("increment_player_score", { _player_id: res.victimId, _score_delta: res.victimDelta });
    if (error) console.error("steal decrement failed:", error);
  }
  return { ...res, mode, victimNickname: res.victimId ? (victim?.nickname ?? null) : null };
}

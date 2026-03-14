import { useParams, useSearchParams } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { GameLobby } from "@/components/game/GameLobby";
import { StudentGameQuestion } from "@/components/game/StudentGameQuestion";
import { GameLeaderboardFinal } from "@/components/game/GameLeaderboardFinal";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calculateScore } from "@/lib/game-types";

const StudentGamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const playerId = searchParams.get("playerId") || "";
  const { session, players, responses, loading } = useGameSession(sessionId);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [lastResult, setLastResult] = useState<{ correct: boolean; score: number } | null>(null);

  // Track which questions have been answered
  useEffect(() => {
    if (!playerId || !responses.length) return;
    const myAnsweredIndexes = new Set(
      responses.filter((r) => r.player_id === playerId).map((r) => r.question_index)
    );
    setAnswered(myAnsweredIndexes);
  }, [responses, playerId]);

  // Reset lastResult when new question starts
  useEffect(() => {
    if (session?.status === "playing") {
      setLastResult(null);
    }
  }, [session?.current_question_index, session?.status]);

  const handleAnswer = async (answerIndex: number) => {
    if (!session || !playerId) return;
    const qi = session.current_question_index;
    if (answered.has(qi)) return;

    const question = session.activity_data[qi];
    const isCorrect = question.answers[answerIndex]?.correct || false;
    const timeLimitMs = (session.settings?.timePerQuestion || 20) * 1000;
    const elapsed = session.question_started_at
      ? Date.now() - new Date(session.question_started_at).getTime()
      : timeLimitMs;
    const score = calculateScore(isCorrect, elapsed, timeLimitMs);

    // Save response
    await supabase.from("game_responses").insert({
      session_id: session.id,
      player_id: playerId,
      question_index: qi,
      answer: { index: answerIndex },
      is_correct: isCorrect,
      response_time_ms: Math.round(elapsed),
      score,
    });

    // Update player total score
    const currentPlayer = players.find((p) => p.id === playerId);
    if (currentPlayer) {
      await supabase.from("game_players").update({
        total_score: currentPlayer.total_score + score,
      }).eq("id", playerId);
    }

    setAnswered((prev) => new Set(prev).add(qi));
    setLastResult({ correct: isCorrect, score });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground text-lg">Načítání...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive text-lg">Hra nebyla nalezena.</p>
      </div>
    );
  }

  if (session.status === "lobby") {
    return <GameLobby session={session} players={players} isTeacher={false} />;
  }

  if (session.status === "finished") {
    return <GameLeaderboardFinal session={session} players={players} responses={responses} highlightPlayerId={playerId} />;
  }

  const currentQ = session.activity_data[session.current_question_index];
  const hasAnswered = answered.has(session.current_question_index);
  const timeLimit = (session.settings?.timePerQuestion || 20) * 1000;
  const questionStarted = session.question_started_at ? new Date(session.question_started_at).getTime() : Date.now();

  return (
    <StudentGameQuestion
      question={currentQ}
      questionIndex={session.current_question_index}
      totalQuestions={session.activity_data.length}
      hasAnswered={hasAnswered}
      lastResult={lastResult}
      onAnswer={handleAnswer}
      timeLimit={timeLimit}
      questionStarted={questionStarted}
      status={session.status}
    />
  );
};

export default StudentGamePlay;

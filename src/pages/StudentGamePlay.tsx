import { useParams } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { GameLobby } from "@/components/game/GameLobby";
import { StudentGameQuestion } from "@/components/game/StudentGameQuestion";
import { GameLeaderboardFinal } from "@/components/game/GameLeaderboardFinal";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { serverTsToClientMs } from "@/lib/clock-sync";

const StudentGamePlay = () => {
  const { sessionId } = useParams<{ sessionId: string }>();

  // Read player identity from sessionStorage (set by secure join flow)
  const { playerId, joinToken } = useMemo(() => {
    if (!sessionId) return { playerId: "", joinToken: "" };
    return {
      playerId: sessionStorage.getItem(`game_player_${sessionId}`) || "",
      joinToken: sessionStorage.getItem(`game_token_${sessionId}`) || "",
    };
  }, [sessionId]);

  const { session, players, responses, loading, connectionStatus, reconnect } = useGameSession(sessionId);
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
    if (!session || !joinToken) return;
    const qi = session.current_question_index;
    if (answered.has(qi)) return;

    // Submit answer via secure edge function (server validates token & computes score)
    const { data, error } = await supabase.functions.invoke("submit-answer", {
      body: { joinToken, answerIndex },
    });

    if (error || data?.error) {
      // If already answered (409), just mark as answered
      if (data?.alreadyAnswered) {
        setAnswered((prev) => new Set(prev).add(qi));
        return;
      }
      console.error("submit-answer error:", data?.error || error?.message);
      return;
    }

    setAnswered((prev) => new Set(prev).add(qi));
    setLastResult({ correct: data.correct, score: data.score });
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

  if (!joinToken || !playerId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive text-lg">Neplatná session. Připojte se znovu přes kód hry.</p>
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
  const questionStarted = session.question_started_at ? serverTsToClientMs(session.question_started_at) : Date.now();

  const currentSlideData = session?.activity_data?.[session?.current_question_index ?? -1] as any;
  const isSlideFormat = currentSlideData && !currentSlideData.question && currentSlideData.projector;

  return (
    <>
      <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
      {isSlideFormat ? (
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex-1 container mx-auto px-4 py-8 max-w-2xl flex flex-col justify-center">
            {currentSlideData.projector?.headline && (
              <h1 className="font-heading text-2xl font-bold mb-4 text-foreground">
                {currentSlideData.projector.headline}
              </h1>
            )}
            {currentSlideData.projector?.body && (
              <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {currentSlideData.projector.body}
              </p>
            )}
            {currentSlideData.device?.instructions && currentSlideData.device.instructions !== "Sledujte výklad." && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary">{currentSlideData.device.instructions}</p>
              </div>
            )}
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">Slide {(session?.current_question_index ?? 0) + 1} / {session?.activity_data?.length ?? 0}</p>
            </div>
          </div>
        </div>
      ) : (
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
      )}
    </>
  );
};

export default StudentGamePlay;

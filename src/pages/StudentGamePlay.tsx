import { useParams } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { GameLobby } from "@/components/game/GameLobby";
import { StudentGameQuestion } from "@/components/game/StudentGameQuestion";
import { GameLeaderboardFinal } from "@/components/game/GameLeaderboardFinal";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { serverTsToClientMs } from "@/lib/clock-sync";
import LessonBlockRenderer from "@/components/LessonBlockRenderer";
import WallResponsesList from "@/components/activities/WallResponsesList";

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

  const [fetchAttempts, setFetchAttempts] = useState(0);
  const { session, players, responses, loading, connectionStatus, reconnect } = useGameSession(sessionId, fetchAttempts);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [lastResult, setLastResult] = useState<{ correct: boolean; score: number } | null>(null);
  const [liveSettings, setLiveSettings] = useState<any>({});

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select("settings")
        .eq("id", sessionId)
        .single();
      if (data) setLiveSettings(data.settings || {});
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    if (!loading && session && session.status === "lobby" && fetchAttempts < 20) {
      const timer = setTimeout(() => {
        setFetchAttempts((a) => a + 1);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, session, fetchAttempts]);

  useEffect(() => {
    if (!loading && session && session.status === "playing" && session.current_question_index === -1 && fetchAttempts < 10) {
      const timer = setTimeout(() => {
        setFetchAttempts((a) => a + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [loading, session, fetchAttempts]);

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="animate-pulse text-muted-foreground text-lg">Čekej na učitele...</div>
          <p className="text-sm text-muted-foreground">Hra začne, jakmile učitel spustí prezentaci.</p>
        </div>
      </div>
    );
  }

  if (session.status === "finished") {
    return <GameLeaderboardFinal session={session} players={players} responses={responses} highlightPlayerId={playerId} />;
  }

  const qi = session.current_question_index;
  const currentSlideData = (session?.activity_data as any[])?.[qi];
  const isSlideFormat = currentSlideData && currentSlideData.projector !== undefined && !currentSlideData.question;

  if (isSlideFormat) {
    return (
      <>
        <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
        <div className="min-h-screen bg-background flex flex-col">
          <div className="flex-1 container mx-auto px-4 py-8 max-w-2xl flex flex-col justify-center">
            {currentSlideData.projector?.headline && (
              <h1 className="font-heading text-2xl font-bold mb-4 text-foreground">
                {currentSlideData.projector.headline}
              </h1>
            )}
            {!currentSlideData.tableData && !currentSlideData.cardData && currentSlideData.projector?.body && (
              <p className="text-base text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {currentSlideData.projector.body}
              </p>
            )}
            {currentSlideData.tableData && (
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      {currentSlideData.tableData.headers.map((h: string, i: number) => (
                        <th key={i} className="border border-border bg-muted px-3 py-2 text-left font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {currentSlideData.tableData.rows.map((row: string[], ri: number) => (
                      <tr key={ri}>
                        {row.map((cell: string, ci: number) => (
                          <td key={ci} className="border border-border px-3 py-2">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {currentSlideData.activitySpec && (
              <div className="mt-4">
                <LessonBlockRenderer
                  block={{
                    id: `live-activity-${currentSlideData.slideId}`,
                    type: "activity",
                    props: {
                      ...currentSlideData.activitySpec,
                      sessionId,
                      playerId,
                      questionIndex: session?.current_question_index ?? 0,
                    },
                    visible: true,
                  } as any}
                  blockIndex={session?.current_question_index ?? 0}
                  onActivityComplete={async (_activityIndex: number, _activityType: string, score: number, maxScore: number) => {
                    if (!sessionId || !playerId) return;
                    try {
                      await supabase.from("game_responses").insert({
                        session_id: sessionId,
                        player_id: playerId,
                        question_index: session?.current_question_index ?? 0,
                        answer: {},
                        is_correct: maxScore > 0 && score / maxScore >= 0.5,
                        score: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
                        response_time_ms: 0,
                      });
                    } catch (e) {
                      console.error("Failed to save activity result:", e);
                    }
                  }}
                />
                {(currentSlideData as any).activitySpec?.activityType === "wall" &&
                  liveSettings?.wallPublished &&
                  liveSettings?.wallPublishedQuestion === qi && (
                    <WallResponsesList
                      sessionId={sessionId || ""}
                      questionIndex={qi}
                      anonymous={(currentSlideData as any).activitySpec?.anonymous || false}
                    />
                  )}
              </div>
            )}
            {currentSlideData.device?.instructions && currentSlideData.device.instructions !== "Sledujte výklad." && (
              <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm font-medium text-primary">{currentSlideData.device.instructions}</p>
              </div>
            )}
            <div className="mt-8 text-center">
              <p className="text-xs text-muted-foreground">
                Slide {qi + 1} / {(session?.activity_data as any[])?.length ?? 0}
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const currentQ = !isSlideFormat ? (session.activity_data as any[])?.[qi] : null;
  const hasAnswered = answered.has(qi);
  const timeLimit = (session.settings?.timePerQuestion || 20) * 1000;
  const questionStarted = session.question_started_at ? serverTsToClientMs(session.question_started_at) : Date.now();

  if (!currentQ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="animate-pulse text-muted-foreground text-lg">Načítám...</div>
      </div>
    );
  }

  return (
    <>
      <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
      <StudentGameQuestion
        question={currentQ}
        questionIndex={qi}
        totalQuestions={(session?.activity_data as any[])?.length ?? 0}
        hasAnswered={hasAnswered}
        lastResult={lastResult}
        onAnswer={handleAnswer}
        timeLimit={timeLimit}
        questionStarted={questionStarted}
        status={session.status}
      />
    </>
  );
};

export default StudentGamePlay;

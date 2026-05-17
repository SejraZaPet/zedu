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
import SlideCanvas from "@/components/admin/SlideCanvas";
import WallResponsesList from "@/components/activities/WallResponsesList";
import WallActivity from "@/components/activities/WallActivity";
import PollActivity from "@/components/activities/PollActivity";
import PollProjectorView from "@/components/activities/PollProjectorView";
import QuizActivity from "@/components/activities/QuizActivity";
import LiveWhiteboard, { WhiteboardData } from "@/components/game/LiveWhiteboard";
import { Lock } from "lucide-react";
import { AvatarSvg } from "@/components/student/AvatarSvg";
import { useStudentAvatar } from "@/hooks/useStudentAvatars";
import { useAuth } from "@/contexts/AuthContext";
import { findPlayerTeam } from "@/lib/game-types";

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
  const { user } = useAuth();
  const myAvatar = useStudentAvatar(user?.id);
  const myPlayer = players.find((p) => p.id === playerId);
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

  const myTeam = findPlayerTeam(session?.teams?.teams, playerId);

  if (session.status === "lobby") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <AvatarSvg slug={myAvatar} size={96} />
          </div>
          {myPlayer?.nickname && (
            <p className="font-heading text-xl font-bold">{myPlayer.nickname}</p>
          )}
          {myTeam && (
            <div
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-semibold"
              style={{ borderColor: myTeam.color, color: myTeam.color, background: `${myTeam.color}1A` }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: myTeam.color }} />
              {myTeam.name}
            </div>
          )}
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
  const whiteboard: WhiteboardData = ((session as any).whiteboard_data as WhiteboardData) ?? { strokes: [], visible: false };
  const currentSlideData = (session?.activity_data as any[])?.[qi];
  const isSlideFormat = currentSlideData && currentSlideData.projector !== undefined && !currentSlideData.question;

  if (isSlideFormat) {
    const isActivity = currentSlideData.type === "activity" && currentSlideData.activitySpec;
    return (
      <>
        <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
        <div
          className="min-h-screen min-h-[100dvh] flex flex-col overflow-y-auto text-white"
          style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}
        >
          {/* Slide preview — stejný vizuál jako projekce, scalovaný do mobilní šířky */}
          <div className="px-3 pt-3">
            <SlideCanvas slide={currentSlideData} darkMode />
          </div>

          {/* Aktivita */}
          {isActivity && (
            <div className="px-3 sm:px-4 pb-4 sm:pb-6 mt-3 sm:mt-4">
              {(currentSlideData as any).activitySpec?.activityType === "wall" ? (
                liveSettings?.wallPublished === true && liveSettings?.wallPublishedQuestion === qi ? (
                  <div
                    className="fixed inset-0 flex flex-col"
                    style={{
                      background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
                      color: "white",
                      zIndex: 50,
                    }}
                  >
                    <div className="flex-1 overflow-y-auto p-4 pb-24">
                      <WallResponsesList
                        sessionId={sessionId || ""}
                        questionIndex={qi}
                        anonymous={liveSettings?.wallAnonymous ?? (currentSlideData as any).activitySpec?.anonymous ?? false}
                        darkMode={true}
                      />
                    </div>
                    {(liveSettings?.wallAllowMultiple ?? (currentSlideData as any).activitySpec?.allowMultiple) ? (
                      <div
                        className="fixed bottom-0 left-0 right-0 p-3 z-10"
                        style={{ background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.15)" }}
                      >
                        <WallActivity
                          question=""
                          anonymous={liveSettings?.wallAnonymous ?? (currentSlideData as any).activitySpec?.anonymous ?? false}
                          allowMultiple={true}
                          sessionId={sessionId}
                          questionIndex={qi}
                          playerId={playerId}
                          onComplete={() => {}}
                        />
                      </div>
                    ) : (
                      <div
                        className="fixed bottom-0 left-0 right-0 p-3 z-10"
                        style={{ background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.15)" }}
                      >
                        <div
                          className="flex items-center gap-2 px-4 py-2 rounded-2xl text-sm"
                          style={{ background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)" }}
                        >
                          <Lock className="w-4 h-4 flex-shrink-0" />
                          <span>Lze odeslat pouze jednu odpověď</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <WallActivity
                    question={(currentSlideData as any).activitySpec?.question || ""}
                    anonymous={liveSettings?.wallAnonymous ?? (currentSlideData as any).activitySpec?.anonymous ?? false}
                    allowMultiple={liveSettings?.wallAllowMultiple ?? (currentSlideData as any).activitySpec?.allowMultiple ?? false}
                    sessionId={sessionId}
                    questionIndex={qi}
                    playerId={playerId}
                    onComplete={() => {}}
                  />
                )
              ) : (currentSlideData as any).activitySpec?.activityType === "poll" ? (
                (() => {
                  const spec = (currentSlideData as any).activitySpec || {};
                  const options = Array.isArray(spec.options) ? spec.options : [];
                  const question = spec.question || "";
                  const allowMultiple = liveSettings?.pollAllowMultiple ?? spec.allowMultiple ?? false;
                  const published =
                    liveSettings?.pollPublished === true &&
                    liveSettings?.pollPublishedQuestion === qi;
                  if (published) {
                    return (
                      <div className="border border-white/15 rounded-xl p-4 bg-white/10 backdrop-blur">
                        <PollProjectorView
                          question={question}
                          options={options}
                          sessionId={sessionId || ""}
                          questionIndex={qi}
                          totalPlayers={players.length}
                        />
                      </div>
                    );
                  }
                  return (
                    <PollActivity
                      question={question}
                      options={options}
                      allowMultiple={allowMultiple}
                      sessionId={sessionId}
                      questionIndex={qi}
                      playerId={playerId}
                      onComplete={() => {}}
                    />
                  );
                })()
              ) : (currentSlideData as any).activitySpec?.activityType === "mcq" ? (
                (() => {
                  const spec = (currentSlideData as any).activitySpec || {};
                  const quiz = {
                    question: spec.question || currentSlideData.projector?.headline || "",
                    answers: (spec.options || []).map((o: any) => ({
                      text: o.text ?? String(o),
                      correct: !!(o.correct ?? o.isCorrect),
                    })),
                  };
                  return (
                    <QuizActivity
                      quiz={quiz}
                      onComplete={async (score, maxScore) => {
                        if (!sessionId || !playerId) return;
                        try {
                          await supabase.from("game_responses").insert({
                            session_id: sessionId,
                            player_id: playerId,
                            question_index: session?.current_question_index ?? 0,
                            answer: {},
                            is_correct: score > 0,
                            score: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
                            response_time_ms: 0,
                          });
                        } catch (e) {
                          console.error("Failed to save mcq result:", e);
                        }
                      }}
                    />
                  );
                })()
              ) : (
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
              )}
            </div>
          )}

          {/* Instrukce + progress */}
          {currentSlideData.device?.instructions && currentSlideData.device.instructions !== "Sledujte výklad." && (
            <div className="mx-3 sm:mx-4 mt-2 p-2.5 sm:p-3 bg-white/10 border border-white/20 rounded-lg backdrop-blur">
              <p className="text-xs sm:text-sm font-medium text-white">{currentSlideData.device.instructions}</p>
            </div>
          )}
          <div className="px-3 sm:px-4 pb-3 sm:pb-4 mt-3 sm:mt-4">
            <div className="h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-400 to-pink-400 transition-all"
                style={{
                  width: `${(((qi + 1) / Math.max(1, (session?.activity_data as any[])?.length ?? 1)) * 100).toFixed(1)}%`,
                }}
              />
            </div>
            <p className="text-[10px] sm:text-xs text-gray-400 text-center mt-1.5 sm:mt-2">
              Slide {qi + 1} / {(session?.activity_data as any[])?.length ?? 0}
            </p>
          </div>

          {whiteboard.visible && whiteboard.strokes.length > 0 && (
            <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
              <WhiteboardOverlay stageW={1600} stageH={900} sessionId={sessionId || ""} data={whiteboard} />
            </div>
          )}
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
      {myTeam && (
        <div
          className="fixed top-2 right-2 z-40 flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-sm font-semibold shadow-sm bg-background/90 backdrop-blur"
          style={{ borderColor: myTeam.color, color: myTeam.color }}
        >
          <span className="w-2 h-2 rounded-full" style={{ background: myTeam.color }} />
          {myTeam.name}
        </div>
      )}
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

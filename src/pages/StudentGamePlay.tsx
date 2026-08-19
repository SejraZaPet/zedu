import { resolveGameMode } from "@/lib/game-slide-settings";
import { useParams } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { GameLobby } from "@/components/game/GameLobby";
import { StudentGameQuestion } from "@/components/game/StudentGameQuestion";
import { GameLeaderboardFinal } from "@/components/game/GameLeaderboardFinal";
import RaceTrack from "@/components/game/RaceTrack";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { TeamsSlideStudent } from "@/components/game/TeamsSlide";
import { DifferentiatedSlideStudent } from "@/components/game/DifferentiatedSlide";
import { EscapeGameStudent } from "@/components/game/EscapeGameSlide";
import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { serverTsToClientMs } from "@/lib/clock-sync";
import LessonBlockRenderer from "@/components/LessonBlockRenderer";
import SlideCanvas from "@/components/admin/SlideCanvas";
import WallResponsesList from "@/components/activities/WallResponsesList";
import WallActivity from "@/components/activities/WallActivity";
import PollActivity from "@/components/activities/PollActivity";
import PollProjectorView from "@/components/activities/PollProjectorView";
import WordCloudActivity from "@/components/activities/WordCloudActivity";
import WordCloudView from "@/components/activities/WordCloudView";
import QuizActivity from "@/components/activities/QuizActivity";
import LiveWhiteboard, { WhiteboardData, getSlideStrokes } from "@/components/game/LiveWhiteboard";
import { isValidZoomRect, isZoomableSlide, zoomStageStyle, type ZoomRect } from "@/lib/zoom-zones";
import { Lock, Pencil, Hand, ChevronLeft, ChevronRight, MessageCircleQuestion } from "lucide-react";
import LiveQuestionsSheet from "@/components/game/LiveQuestionsSheet";
import ProfileAvatarBubble from "@/components/profile/ProfileAvatarBubble";

import { gameBackgroundStyle, sessionBackgroundUrl } from "@/lib/game-backgrounds";
import { useAuth } from "@/contexts/AuthContext";
import { findPlayerTeam, buildAnonymousLabelMap, type GamePlayer } from "@/lib/game-types";

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
  const { session, players, responses, loading, connectionStatus, reconnect } = useGameSession(sessionId, fetchAttempts, joinToken);
  const { user } = useAuth();

  const myPlayer = players.find((p) => p.id === playerId);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [lastResult, setLastResult] = useState<{ correct: boolean; score: number } | null>(null);
  const [modeFeedback, setModeFeedback] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const [liveSettings, setLiveSettings] = useState<any>({});
  const [studentDrawMode, setStudentDrawMode] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(async () => {
      const { data } = await supabase.rpc("get_player_session" as any, {
        _session_id: sessionId,
        _join_token: joinToken || null,
      });
      const row = Array.isArray(data) ? (data as any[])[0] : (data as any);
      if (row) setLiveSettings(row.settings || {});
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionId, joinToken]);

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
    const settings = (session.settings as any) || {};
    const isRace = settings.gameMode === "race";
    // In race / student-paced modes each student is on their own question.
    const pacing = settings.pacingMode === "student" || isRace ? "student" : "teacher";
    const localQi =
      pacing === "student"
        ? Math.max(0, Math.min(((session.activity_data as any[])?.length ?? 1) - 1, myPlayer?.student_index ?? 0))
        : session.current_question_index;
    if (!isRace && answered.has(localQi)) return;

    // Submit answer via secure edge function (server validates token & computes score)
    const { data, error } = await supabase.functions.invoke("submit-answer", {
      body: { joinToken, answerIndex },
    });

    if (error || data?.error) {
      // If already answered (409), just mark as answered
      if (data?.alreadyAnswered) {
        setAnswered((prev) => new Set(prev).add(localQi));
        return;
      }
      console.error("submit-answer error:", data?.error || error?.message);
      return;
    }

    if (isRace && data.correct === false) {
      // Wrong answer in race mode: show shake, allow immediate retry (server did NOT persist).
      setLastResult({ correct: false, score: 0 });
      setTimeout(() => setLastResult(null), 800);
      return;
    }

    setAnswered((prev) => new Set(prev).add(localQi));
    setLastResult({ correct: data.correct, score: data.score });

    // Mode-specific micro-feedback for tower / steal (per-slide override wins).
    const currentSlide = ((session.activity_data as any[]) || [])[localQi];
    const mode = resolveGameMode(settings, currentSlide);
    if (mode === "tower" && data.correct) {
      setModeFeedback({ text: "+🧱 Kostka!", tone: "good" });
      setTimeout(() => setModeFeedback(null), 1400);
    } else if (mode === "steal") {
      if (data.correct) {
        const victimNick = (data as any).stolenFromNickname
          || (data?.stolenFrom ? players.find((p) => p.id === data.stolenFrom)?.nickname : null);
        setModeFeedback({
          text: victimNick
            ? `🏴‍☠️ Ukradl jsi 5 bodů ${victimNick}!`
            : "🏴‍☠️ +5 bodů!",
          tone: "good",
        });
      } else {
        setModeFeedback({ text: "💸 Přišel jsi o 3 body", tone: "bad" });
      }
      setTimeout(() => setModeFeedback(null), 1800);
    }

    if (isRace && data.correct) {
      // Auto-advance to next question after brief positive feedback.
      setTimeout(() => {
        setLastResult(null);
        void setMyStudentIndex(localQi + 1);
      }, 700);
    }
  };

  // ---- Derived state + remaining hooks ------------------------------------
  // IMPORTANT: every hook must be declared ABOVE the early returns below.
  // Otherwise the hook order changes when `session.status` flips (lobby → playing)
  // and React throws "change in the order of Hooks", which unmounts the whole
  // student screen (blank page).
  const settingsAny = (session?.settings as any) || {};
  const pacingMode = settingsAny.pacingMode === "student" ? "student" : "teacher";
  const totalSlides = (session?.activity_data as any[])?.length ?? 0;
  const isRaceMode = settingsAny.gameMode === "race";
  const gameBackgroundUrl = sessionBackgroundUrl(liveSettings) ?? sessionBackgroundUrl(settingsAny);

  // Initialize student_index once when entering student-paced mode without a value
  useEffect(() => {
    if (pacingMode !== "student") return;
    if (!joinToken) return;
    if (myPlayer && (myPlayer.student_index === null || myPlayer.student_index === undefined)) {
      supabase.rpc("set_student_index" as any, { _join_token: joinToken, _index: 0 });
    }
  }, [pacingMode, joinToken, myPlayer?.id, myPlayer?.student_index]);

  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isRaceMode) return;
    const id = setInterval(() => setNowTick(Date.now()), 500);
    return () => clearInterval(id);
  }, [isRaceMode]);

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
            <ProfileAvatarBubble userId={user?.id ?? null} size={96} editable={false} />
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

  const anonymousAnswers = !!(session.settings as any)?.anonymousAnswers;
  const anonymousLabelMap = anonymousAnswers ? buildAnonymousLabelMap(players as GamePlayer[]) : undefined;
  const teacherQi = session.current_question_index;
  const studentQi = Math.max(0, Math.min(totalSlides - 1, myPlayer?.student_index ?? 0));
  const qi = pacingMode === "student" ? studentQi : teacherQi;
  const whiteboard: WhiteboardData = ((session as any).whiteboard_data as WhiteboardData) ?? { visible: false, strokesBySlide: {} };
  const currentSlideData = (session?.activity_data as any[])?.[qi];
  const rawZoom = (session as any).zoom_state;
  // Zoom follows the teacher only on the slide they are presenting (and only for
  // explanatory slides). Independent of whiteboard visibility.
  const liveZoom: ZoomRect | null =
    qi === teacherQi && isZoomableSlide(currentSlideData) && isValidZoomRect(rawZoom)
      ? (rawZoom as ZoomRect)
      : null;
  const isSlideFormat = currentSlideData && currentSlideData.projector !== undefined && !currentSlideData.question;

  const setMyStudentIndex = async (next: number) => {
    if (!joinToken) return;
    const bounded = Math.max(0, Math.min(totalSlides - 1, next));
    await supabase.rpc("set_student_index" as any, { _join_token: joinToken, _index: bounded });
  };

  const toggleHand = async () => {
    if (!joinToken) return;
    await supabase.rpc("raise_hand" as any, {
      _join_token: joinToken,
      _raised: !myPlayer?.hand_raised,
    });
  };

  // ---- Race mode (Time-to-Climb) student-side overlay ----
  const raceSettings = settingsAny;
  const raceStartedAtMs = raceSettings.raceStartedAt ? new Date(raceSettings.raceStartedAt).getTime() : null;
  const raceDurationSec = Number(raceSettings.raceDurationSec) || 180;


  if (isRaceMode) {
    const remainingSec = raceStartedAtMs
      ? Math.max(0, Math.round((raceStartedAtMs + raceDurationSec * 1000 - nowTick) / 1000))
      : raceDurationSec;
    const myIdx = myPlayer?.student_index ?? 0;
    const finishedRace = myIdx >= totalSlides;
    const timeUp = raceStartedAtMs !== null && nowTick >= raceStartedAtMs + raceDurationSec * 1000;

    if (finishedRace || timeUp) {
      return (
        <div
          className="min-h-screen min-h-[100dvh] flex flex-col items-center justify-center gap-6 p-6 text-white"
          style={gameBackgroundStyle(gameBackgroundUrl)}
        >
          <p className="text-6xl">{finishedRace ? "🏁" : "⏰"}</p>
          <h1 className="text-3xl font-bold text-center">
            {finishedRace ? "Dojel jsi do cíle!" : "Čas vypršel"}
          </h1>
          <p className="text-white/70 text-center">
            {finishedRace
              ? "Počkej na ostatní, výsledky brzy uvidíš."
              : "Podívej se, kdo dojel nejdál."}
          </p>
          <div className="w-full max-w-3xl">
            <RaceTrack
              session={session}
              players={players}
              mode="progress"
              highlightPlayerId={playerId}
              compact
            />
          </div>
        </div>
      );
    }
  }




  if (isSlideFormat) {
    const isActivity = currentSlideData.type === "activity" && currentSlideData.activitySpec;
    return (
      <>
        <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
        {modeFeedback && (
          <div
            className={`fixed top-16 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full text-sm font-semibold shadow-xl border-2 pointer-events-none animate-in fade-in slide-in-from-top-2 ${
              modeFeedback.tone === "good"
                ? "bg-emerald-500 text-white border-emerald-300"
                : "bg-rose-500 text-white border-rose-300"
            }`}
            role="status"
            aria-live="polite"
          >
            {modeFeedback.text}
          </div>
        )}
        <div
          className="min-h-screen min-h-[100dvh] flex flex-col overflow-y-auto text-white"
          style={gameBackgroundStyle(gameBackgroundUrl)}
        >
          {/* Floating hand-raise toggle */}
          <button
            onClick={toggleHand}
            className={`fixed top-3 right-3 z-40 rounded-full px-3 py-2 text-sm font-medium shadow-lg flex items-center gap-1.5 border ${
              myPlayer?.hand_raised
                ? "bg-amber-400 text-slate-900 border-amber-300"
                : "bg-white/10 text-white border-white/20 backdrop-blur"
            }`}
            aria-pressed={!!myPlayer?.hand_raised}
            aria-label={myPlayer?.hand_raised ? "Položit ruku" : "Zvednout ruku"}
          >
            <Hand className="w-4 h-4" />
            {myPlayer?.hand_raised ? "Ruka nahoře" : "Zvednout ruku"}
          </button>

          {/* Floating "Ask" button */}
          <button
            onClick={() => setQuestionsOpen(true)}
            className="fixed top-14 right-3 z-40 rounded-full px-3 py-2 text-sm font-medium shadow-lg flex items-center gap-1.5 border bg-white/10 text-white border-white/20 backdrop-blur"
            aria-label="Zeptej se"
          >
            <MessageCircleQuestion className="w-4 h-4" />
            Zeptej se
          </button>

          {sessionId && (
            <LiveQuestionsSheet
              open={questionsOpen}
              onOpenChange={setQuestionsOpen}
              sessionId={sessionId}
              role="student"
              joinToken={joinToken}
              playerId={playerId}
              players={players as any}
              anonymous={anonymousAnswers}
            />
          )}

          {/* Slide preview — stejný vizuál jako projekce, scalovaný do mobilní šířky.
              Kreslicí vrstva je uvnitř TOHOTO boxu (16:9), takže plátno přesně odpovídá slidu. */}
          <div className="px-3 pt-3">
            <div className="relative overflow-hidden rounded-xl aspect-video w-full">
              <div className="absolute inset-0" style={zoomStageStyle(liveZoom)}>
                <SlideCanvas key={qi} slide={currentSlideData} themeId={(currentSlideData as any)?.themeId} darkMode />
              </div>
              {(() => {
                const allowSync = !!liveSettings?.allowStudentDrawSync;
                const teacherBoardVisible = getSlideStrokes(whiteboard, qi).length > 0;
                if (!teacherBoardVisible && !studentDrawMode) return null;
                return (
                  <div
                    className={`absolute inset-0 z-30 overflow-hidden ${studentDrawMode ? "" : "pointer-events-none"}`}
                  >
                    <WhiteboardOverlay
                      stageW={1600}
                      stageH={900}
                      zoom={liveZoom}
                      sessionId={sessionId || ""}
                      data={whiteboard}
                      slideIndex={qi}
                      interactive={studentDrawMode}
                      localOnly={!allowSync}
                    />
                  </div>
                );
              })()}
            </div>
          </div>


          {/* Vlastní tempo — navigace mezi slidy */}
          {pacingMode === "student" && (
            <div className="px-3 pt-3 flex items-center justify-between gap-2">
              <button
                onClick={() => setMyStudentIndex(studentQi - 1)}
                disabled={studentQi <= 0}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/15 py-2 text-sm"
              >
                <ChevronLeft className="w-4 h-4" /> Předchozí
              </button>
              <span className="text-xs opacity-70 tabular-nums">
                {studentQi + 1} / {totalSlides}
              </span>
              <button
                onClick={() => setMyStudentIndex(studentQi + 1)}
                disabled={studentQi >= totalSlides - 1}
                className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 disabled:opacity-40 border border-white/15 py-2 text-sm"
              >
                Další <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}


          {/* Aktivita */}
          {isActivity && (currentSlideData as any).activitySpec?.activityType === "teams" && (
            <TeamsSlideStudent session={session} playerId={playerId} />
          )}

          {isActivity && (currentSlideData as any).activitySpec?.activityType === "differentiated" && (
            <DifferentiatedSlideStudent session={session} playerId={playerId} slide={currentSlideData} />
          )}

          {isActivity && (currentSlideData as any).activitySpec?.activityType === "escape" && (
            <EscapeGameStudent slide={currentSlideData} />
          )}

          {isActivity && (currentSlideData as any).activitySpec?.activityType !== "teams" && (currentSlideData as any).activitySpec?.activityType !== "differentiated" && (currentSlideData as any).activitySpec?.activityType !== "escape" && (
            <div className="px-3 sm:px-4 pb-4 sm:pb-6 mt-3 sm:mt-4">
              {(currentSlideData as any).activitySpec?.activityType === "wall" ? (
                liveSettings?.wallPublished === true && liveSettings?.wallPublishedQuestion === qi ? (
                  <div
                    className="fixed inset-0 flex flex-col"
                    style={{
                      ...gameBackgroundStyle(gameBackgroundUrl),
                      color: "white",
                      zIndex: 50,
                    }}
                  >
                    <div className="flex-1 overflow-y-auto p-4 pb-24">
                      <WallResponsesList
                        sessionId={sessionId || ""}
                        questionIndex={qi}
                        anonymous={liveSettings?.wallAnonymous ?? (currentSlideData as any).activitySpec?.anonymous ?? false}
                        anonymousLabelMap={anonymousLabelMap}
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
                      joinToken={joinToken}
                      onComplete={() => {}}
                    />
                  );
                })()
              ) : (currentSlideData as any).activitySpec?.activityType === "wordcloud" ? (
                (() => {
                  const spec = (currentSlideData as any).activitySpec || {};
                  const question = spec.question || "";
                  const published =
                    liveSettings?.wordcloudPublished === true &&
                    liveSettings?.wordcloudPublishedQuestion === qi;
                  return (
                    <div className="space-y-4">
                      <WordCloudActivity
                        question={question}
                        sessionId={sessionId}
                        questionIndex={qi}
                        playerId={playerId}
                        joinToken={joinToken}
                      />
                      {published && (
                        <div className="border border-white/15 rounded-xl p-4 bg-white/10 backdrop-blur">
                          <WordCloudView
                            sessionId={sessionId || ""}
                            questionIndex={qi}
                            published={true}
                            darkMode={true}
                          />
                        </div>
                      )}
                    </div>
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
                          await supabase.functions.invoke("submit-activity-response", {
                            body: {
                              joinToken,
                              playerId,
                              sessionId,
                              questionIndex: session?.current_question_index ?? 0,
                              isCorrect: score > 0,
                              score: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
                              responseTimeMs: 0,
                            },
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
                      joinToken,
                      questionIndex: session?.current_question_index ?? 0,
                    },
                    visible: true,
                  } as any}
                  blockIndex={session?.current_question_index ?? 0}
                  onActivityComplete={async (_activityIndex: number, _activityType: string, score: number, maxScore: number) => {
                    if (!sessionId || !playerId) return;
                    try {
                      await supabase.functions.invoke("submit-activity-response", {
                        body: {
                          joinToken,
                          playerId,
                          sessionId,
                          questionIndex: session?.current_question_index ?? 0,
                          isCorrect: maxScore > 0 && score / maxScore >= 0.5,
                          score: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
                          responseTimeMs: 0,
                        },
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

          {(() => {
            const allowSync = !!liveSettings?.allowStudentDrawSync;
            // `visible` is the teacher's own local panel state — students always see
            // existing strokes for the current slide whenever any exist.
            const teacherBoardVisible = getSlideStrokes(whiteboard, qi).length > 0;
            const showBoard = teacherBoardVisible || studentDrawMode;
            if (!showBoard && !allowSync && !teacherBoardVisible) {
              // still allow student to open their local scratch pad via button
            }
            return (
              <>
                <button
                  type="button"
                  onClick={() => setStudentDrawMode((v) => !v)}
                  aria-label={studentDrawMode ? "Vypnout kreslení" : "Zapnout kreslení"}
                  title={studentDrawMode ? "Vypnout kreslení" : "Zapnout kreslení"}
                  className={`fixed bottom-4 right-4 z-[60] h-12 w-12 rounded-full shadow-lg flex items-center justify-center border-2 transition-colors ${
                    studentDrawMode
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background/90 text-foreground border-border"
                  }`}
                >
                  <Pencil className="w-5 h-5" />
                </button>
                {(showBoard || teacherBoardVisible) && (
                  <div
                    className={`fixed inset-0 z-30 overflow-hidden ${studentDrawMode ? "" : "pointer-events-none"}`}
                  >
                    <WhiteboardOverlay
                      stageW={1600}
                      stageH={900}
                      zoom={liveZoom}
                      sessionId={sessionId || ""}
                      data={whiteboard}
                      slideIndex={qi}
                      interactive={studentDrawMode}
                      localOnly={!allowSync}
                    />
                  </div>
                )}
              </>
            );
          })()}
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
      {modeFeedback && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-full text-sm font-semibold shadow-xl border-2 pointer-events-none animate-in fade-in slide-in-from-top-2 ${
            modeFeedback.tone === "good"
              ? "bg-emerald-500 text-white border-emerald-300"
              : "bg-rose-500 text-white border-rose-300"
          }`}
          role="status"
          aria-live="polite"
        >
          {modeFeedback.text}
        </div>
      )}
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
        myUserId={user?.id ?? null}
      />
    </>
  );
};



const WhiteboardOverlay = ({
  stageW,
  stageH,
  sessionId,
  data,
  slideIndex,
  interactive = false,
  localOnly = false,
  zoom = null,
}: {
  stageW: number;
  stageH: number;
  sessionId: string;
  data: WhiteboardData;
  slideIndex: number;
  interactive?: boolean;
  localOnly?: boolean;
  zoom?: ZoomRect | null;
}) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setScale(Math.min(w / stageW, h / stageH));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, { passive: true });
    const onOrientation = () => {
      // Mobilní prohlížeče mění viewport postupně (adresní řádek se skrývá
      // se zpožděním), proto přepočítáváme scale opakovaně po orientationchange.
      update();
      setTimeout(update, 150);
      setTimeout(update, 400);
    };
    window.addEventListener("orientationchange", onOrientation);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", onOrientation);
    };
  }, [stageW, stageH]);

  return (
    <div ref={frameRef} className="absolute inset-0">
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: `${stageW}px`,
          height: `${stageH}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0" style={zoomStageStyle(zoom)}>
        <LiveWhiteboard
          sessionId={sessionId}
          data={data}
          slideIndex={slideIndex}
          readOnly={!interactive}
          overlay
          localOnly={localOnly}
          simplified
          className={interactive ? "" : "pointer-events-none"}
        />
        </div>
        </div>
      </div>
    </div>
  );
};

export default StudentGamePlay;

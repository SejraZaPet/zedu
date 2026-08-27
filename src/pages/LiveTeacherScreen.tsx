import { useParams, useNavigate } from "react-router-dom";
import { useGameSession, useTeacherGameControls } from "@/hooks/useGameSession";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { GameLobby } from "@/components/game/GameLobby";
import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, StickyNote, ChevronLeft, ChevronRight, Users, StopCircle, ArrowLeft, Brain, Plus, Pencil, BarChart3, MessageCircleQuestion, Eye, LayoutGrid, Settings, Wrench, ZoomIn, ZoomOut, Crosshair } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import LiveQuestionsSheet, { useLiveQuestions } from "@/components/game/LiveQuestionsSheet";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import StudentProgressGrid from "@/components/game/StudentProgressGrid";
import SessionExports from "@/components/live/SessionExports";
import { AdaptiveReviewDialog } from "@/components/game/AdaptiveReview";
import { AddSlideSheet } from "@/components/game/AddSlideSheet";
import { isMixedPresentation } from "@/lib/game-slide-settings";
import GameBackgroundSelect from "@/components/game/GameBackgroundSelect";
import { sessionBackgroundUrl } from "@/lib/game-backgrounds";
import { TeamsSlideTeacher } from "@/components/game/TeamsSlide";
import { DifferentiatedSlideTeacher } from "@/components/game/DifferentiatedSlide";
import { EscapeGameOverview } from "@/components/game/EscapeGameSlide";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PollProjectorView from "@/components/activities/PollProjectorView";
import WordCloudView from "@/components/activities/WordCloudView";
import LiveWhiteboard, { WhiteboardData } from "@/components/game/LiveWhiteboard";
import RemoteControlButton from "@/components/live/RemoteControlButton";
import { presenterRemoteChannelName } from "@/pages/PresenterRemote";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import { useSwipe } from "@/hooks/useSwipe";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import { GAME_MODES, getModeDef, type GameMode } from "@/lib/game-modes";
import type { TeamMode } from "@/lib/game-types";
import AiClusterButton from "@/components/live/AiClusterButton";
import ZoomZoneSurface from "@/components/live/ZoomZoneSurface";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { getZoomZones, isValidZoomRect, isZoomableSlide, zoomStageStyle, type ZoomRect } from "@/lib/zoom-zones";

interface SlideData {
  slideId: string;
  type: string;
  projector: { headline: string; body: string };
  device: { instructions: string };
  teacherNotes?: string;
}

const SLIDE_TYPE_LABELS: Record<string, string> = {
  intro: "Úvod", objective: "Cíl", explain: "Výklad",
  practice: "Procvičení", activity: "Aktivita", summary: "Shrnutí", exit: "Exit ticket",
};

const LiveTeacherScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const { session, players, responses, loading, connectionStatus, reconnect } = useGameSession(sessionId, fetchAttempts);
  const { startGame, nextQuestion, endGame } = useTeacherGameControls(sessionId);
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [addSlideOpen, setAddSlideOpen] = useState(false);
  const [resultsPanelOpen, setResultsPanelOpen] = useState(false);
  const [progressGridOpen, setProgressGridOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const projectorPreviewRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const slides: SlideData[] = (session?.activity_data as any[]) || [];
  const currentIndex = session?.current_question_index ?? -1;
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const isLobby = session?.status === "lobby";
  const isFinished = session?.status === "finished";
  const settings = session?.settings as any;
  const gameCode = session?.game_code || "";
  const whiteboard: WhiteboardData = ((session as any)?.whiteboard_data as WhiteboardData) ?? { visible: false, strokesBySlide: {} };
  const whiteboardVisible = whiteboard.visible;
  const { unansweredCount } = useLiveQuestions(sessionId);

  // ---- Přiblížení (zoom do výřezu) ----
  const [drawZoomMode, setDrawZoomMode] = useState(false);
  const zoomable = isZoomableSlide(currentSlide);
  const zoomZones = getZoomZones(currentSlide);
  const rawZoom = (session as any)?.zoom_state;
  const activeZoom: ZoomRect | null =
    zoomable && isValidZoomRect(rawZoom) ? (rawZoom as ZoomRect) : null;

  const applyZoom = useCallback(async (rect: ZoomRect | null) => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({ zoom_state: rect as any }).eq("id", sessionId);
  }, [sessionId]);

  // Reveal step (progressive bullet reveal). Reset to 1 on slide change.
  const revealStep = typeof settings?.revealStep === "number" ? settings.revealStep : 999;
  const hasRevealBlocks = !!(currentSlide as any)?.blocks?.some(
    (b: any) => b?.type === "bullet_list" && b?.props?.revealMode
  );
  const maxRevealCount = (() => {
    const blocks = ((currentSlide as any)?.blocks || []) as any[];
    let max = 0;
    for (const b of blocks) {
      if (b?.type !== "bullet_list" || !b?.props?.revealMode) continue;
      if (Array.isArray(b.props.items)) max = Math.max(max, b.props.items.length);
      else if (typeof b.props.html === "string") {
        max = Math.max(max, (b.props.html.match(/<li[\s>]/gi) || []).length);
      }
    }
    return max;
  })();

  const revealNext = useCallback(async () => {
    if (!sessionId) return;
    const next = Math.min(maxRevealCount, (revealStep === 999 ? 1 : revealStep) + 1);
    await supabase
      .from("game_sessions")
      .update({ settings: { ...(settings || {}), revealStep: next } })
      .eq("id", sessionId);
  }, [sessionId, settings, revealStep, maxRevealCount]);

  const toggleWhiteboard = useCallback(async () => {
    if (!sessionId) return;
    // Atomic backend toggle changes `visible` only and preserves all slide strokes.
    await supabase.rpc("toggle_game_whiteboard", { _session_id: sessionId });
  }, [sessionId]);

  const handleProjectorScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    const scrollTop = e.currentTarget.scrollTop;
    scrollTimerRef.current = setTimeout(async () => {
      if (!sessionId) return;
      await supabase.from("game_sessions").update({
        settings: { ...(settings || {}), projectorScrollTop: scrollTop },
      }).eq("id", sessionId);
    }, 100);
  }, [sessionId, settings]);

  // Reset scroll position when slide changes
  useEffect(() => {
    if (!sessionId) return;
    supabase.from("game_sessions").update({
      settings: { ...(settings || {}), projectorScrollTop: 0, revealStep: 1 },
      zoom_state: null,
    }).eq("id", sessionId);
    setDrawZoomMode(false);
    if (projectorPreviewRef.current) {
      projectorPreviewRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const handleNext = useCallback(() => {
    if (!session) return;
    if (currentIndex >= slides.length - 1) {
      endGame();
    } else {
      nextQuestion(currentIndex);
    }
  }, [session, currentIndex, slides.length, nextQuestion, endGame]);

  const goToIndex = useCallback(async (target: number) => {
    if (!sessionId) return;
    if (target < 0 || target >= slides.length) return;
    await supabase.from("game_sessions").update({
      current_question_index: target,
      question_started_at: new Date().toISOString(),
      status: "playing",
    }).eq("id", sessionId);
  }, [sessionId, slides.length]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => { if (currentIndex < slides.length - 1) handleNext(); },
    onSwipeRight: () => { if (currentIndex > 0) nextQuestion(currentIndex - 2); },
  });

  // Race mode auto-end: finish the session when either every player has crossed
  // the finish line or the countdown expires. Guarded so we only fire once.
  const raceEndFiredRef = useRef(false);
  useEffect(() => {
    if (!session) return;
    if (settings?.gameMode !== "race") return;
    if (session.status !== "playing") return;
    if (raceEndFiredRef.current) return;
    const totalQ = slides.length;
    if (totalQ === 0) return;
    const startedAt = settings?.raceStartedAt ? new Date(settings.raceStartedAt).getTime() : null;
    const durMs = (Number(settings?.raceDurationSec) || 180) * 1000;
    const check = () => {
      const timeUp = startedAt !== null && Date.now() >= startedAt + durMs;
      const everyoneDone =
        players.length > 0 &&
        players.every((p) => (p.student_index ?? 0) >= totalQ);
      if (timeUp || everyoneDone) {
        raceEndFiredRef.current = true;
        endGame();
      }
    };
    check();
    const id = setInterval(check, 1000);
    return () => clearInterval(id);
  }, [session, settings, players, slides.length, endGame]);


  // Listen for commands from mobile remote
  useEffect(() => {
    if (!sessionId) return;
    const ch = supabase.channel(presenterRemoteChannelName(sessionId), {
      config: { broadcast: { self: false } },
    });
    ch.on("broadcast", { event: "remote-cmd" }, ({ payload }) => {
      const cmd = payload?.cmd as string;
      if (cmd === "next") handleNext();
      else if (cmd === "prev") {
        if (currentIndex > 0) nextQuestion(currentIndex - 2);
      } else if (cmd === "end") {
        endGame();
      } else if (cmd === "goto" && typeof payload?.index === "number") {
        goToIndex(payload.index);
      } else if (cmd === "pause" || cmd === "resume") {
        supabase.from("game_sessions").update({
          settings: { ...(settings || {}), paused: cmd === "pause" },
        }).eq("id", sessionId);
      }
    });
    ch.subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [sessionId, handleNext, nextQuestion, endGame, currentIndex, goToIndex, settings]);

  // Refetch session data if slides arrive empty (race with DB write)
  useEffect(() => {
    if (!loading && session && slides.length === 0 && !isFinished && fetchAttempts < 8) {
      const delay = fetchAttempts < 3 ? 300 : 600;
      const timer = setTimeout(() => {
        setFetchAttempts((a) => a + 1);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [loading, session, slides.length, isFinished, fetchAttempts]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítání…</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-destructive">Session nenalezena.</p>
      </div>
    );
  }

  if (isLobby) {
    const gameMode: GameMode = (settings?.gameMode as GameMode) || "standard";
    const currentModeDef = getModeDef(gameMode);
    const raceDur = Number(settings?.raceDurationSec) || 180;
    const teamKind: TeamMode = (settings?.teamModeKind as TeamMode) ?? "none";
    const teamCount: number = Number(settings?.teamCount ?? 2);

    const setGameMode = async (id: GameMode) => {
      if (!sessionId) return;
      const def = getModeDef(id);
      await supabase
        .from("game_sessions")
        .update({
          settings: {
            ...(settings || {}),
            gameMode: id,
            theme: def.themes[0].id,
            raceDurationSec: raceDur,
          },
        })
        .eq("id", sessionId);
    };
    const setTheme = async (themeId: string) => {
      if (!sessionId) return;
      await supabase
        .from("game_sessions")
        .update({ settings: { ...(settings || {}), theme: themeId } })
        .eq("id", sessionId);
    };
    const setRaceDur = async (sec: number) => {
      if (!sessionId) return;
      const clamped = Math.max(30, Math.min(1800, Math.round(sec)));
      await supabase
        .from("game_sessions")
        .update({ settings: { ...(settings || {}), raceDurationSec: clamped } })
        .eq("id", sessionId);
    };
    const setTeamKind = async (kind: TeamMode) => {
      if (!sessionId) return;
      await supabase
        .from("game_sessions")
        .update({
          settings: {
            ...(settings || {}),
            teamModeKind: kind,
            teamMode: kind !== "none",
            teamCount: teamCount || 2,
          },
        })
        .eq("id", sessionId);
    };
    const setTeamCount = async (n: number) => {
      if (!sessionId) return;
      const clamped = Math.max(2, Math.min(6, n));
      await supabase
        .from("game_sessions")
        .update({ settings: { ...(settings || {}), teamCount: clamped } })
        .eq("id", sessionId);
    };
    const wrappedStart = async () => {
      if (gameMode === "race" && sessionId) {
        // Stamp race start metadata BEFORE flipping status to playing.
        await supabase
          .from("game_sessions")
          .update({
            settings: {
              ...(settings || {}),
              gameMode: "race",
              raceDurationSec: raceDur,
              raceStartedAt: new Date().toISOString(),
              pacingMode: "student",
            },
          })
          .eq("id", sessionId);
      }
      startGame();
    };
    // Mixed presentation (výklad + aktivity): no mandatory game-mode picker.
    // Session defaults to 'standard' without teams; individual activity slides
    // can override via slide.gameSettings.
    const mixed = isMixedPresentation(slides);

    return (
      <>
        {!mixed && (
        <div className="fixed top-3 left-3 right-3 sm:right-auto z-40 max-w-md rounded-xl border border-border bg-card/95 backdrop-blur p-3 shadow-lg space-y-3 max-h-[92vh] overflow-y-auto">

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Herní režim
            </p>
            <div className="grid grid-cols-2 gap-2">
              {GAME_MODES.map((m) => {
                const active = gameMode === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setGameMode(m.id)}
                    className={`text-left rounded-lg border-2 p-2.5 transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-lg">{m.emoji}</span>
                      <span className="font-semibold text-sm">{m.name}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">{m.description}</p>
                    <p className="text-[10px] text-primary font-medium mt-0.5">{m.scoringHint}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {currentModeDef.themes.length > 1 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Téma
              </p>
              <div className="flex flex-wrap gap-1.5">
                {currentModeDef.themes.map((th) => {
                  const active = (settings?.theme ?? currentModeDef.themes[0].id) === th.id;
                  return (
                    <button
                      key={th.id}
                      type="button"
                      onClick={() => setTheme(th.id)}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors inline-flex items-center gap-1 ${
                        active
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <span>{th.emoji}</span> {th.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {gameMode === "race" && (
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Délka závodu</span>
              <span className="inline-flex items-center gap-1">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={Math.max(1, Math.round(raceDur / 60))}
                  onChange={(e) => setRaceDur(Number(e.target.value) * 60)}
                  className="w-14 rounded-md border border-border bg-background px-2 py-1 text-right"
                />
                <span>min</span>
              </span>
            </label>
          )}

          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Týmy
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: "none", label: "Bez týmů" },
                { id: "random", label: "Náhodné" },
                { id: "manual", label: "Ručně" },
              ] as { id: TeamMode; label: string }[]).map((opt) => {
                const active = teamKind === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTeamKind(opt.id)}
                    className={`rounded-lg border-2 px-2 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {teamKind !== "none" && (
              <div className="mt-2 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Počet týmů:</span>
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  value={teamCount}
                  onChange={(e) => setTeamCount(parseInt(e.target.value, 10))}
                >
                  {[2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
                <span className="text-[11px] text-muted-foreground">
                  {teamKind === "random" ? "Auto rozdělení po připojení" : "Drag & drop v lobby"}
                </span>
              </div>
            )}
          </div>
        </div>
        )}

        <GameLobby session={session} players={players} onStart={wrappedStart} isTeacher />
      </>
    );
  }


  if (isFinished) {
    return (
      <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Výuka ukončena</h1>
          <p className="text-muted-foreground">{slides.length} slidů · {players.length} účastníků</p>
        </div>
        <div className="flex justify-center">
          <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/ucebnice")} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Zpět do učebnice
          </Button>
        </div>
        <SessionExports sessionId={sessionId!} sessionTitle={session.title} />
      </div>
    );
  }

  // Playing: show current slide
  return (
    <>
    <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto space-y-6" {...swipeHandlers}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => navigate("/ucitel/ucebnice")} className="gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Učebnice
          </Button>
          <div>
            <h1 className="text-lg font-bold">{session.title}</h1>
            <p className="text-sm text-muted-foreground">
              Kód: <span className="font-mono font-bold">{gameCode}</span> · <Users className="w-3.5 h-3.5 inline" /> {players.length}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Badge variant="outline">Slide {currentIndex + 1} / {slides.length}</Badge>

          {/* Zobrazení */}
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant="outline"
                    className="h-9 w-9"
                    aria-label="Projektor"
                    onClick={() => window.open(`/live/projektor/${sessionId}`, '_blank')}
                  >
                    <Monitor className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Projektor</TooltipContent>
              </Tooltip>
              {sessionId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span><RemoteControlButton sessionId={sessionId} iconOnly /></span>
                  </TooltipTrigger>
                  <TooltipContent>Ovládání z mobilu</TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={whiteboardVisible ? "default" : "outline"}
                    className="h-9 w-9"
                    onClick={toggleWhiteboard}
                    aria-label={whiteboardVisible ? "Skrýt tabuli" : "Tabule"}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{whiteboardVisible ? "Skrýt tabuli" : "Živá tabule"}</TooltipContent>
              </Tooltip>

              {zoomable && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      size="icon"
                      variant={activeZoom ? "default" : "outline"}
                      className="h-9 w-9"
                      aria-label="Přiblížit"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-80 space-y-3">
                    <p className="text-sm font-semibold">Přiblížení</p>
                    {zoomZones.length > 0 ? (
                      <div className="space-y-1.5">
                        {zoomZones.map((z, i) => {
                          const isActive =
                            !!activeZoom &&
                            Math.abs(activeZoom.x - z.x) < 0.5 &&
                            Math.abs(activeZoom.y - z.y) < 0.5 &&
                            Math.abs(activeZoom.width - z.width) < 0.5;
                          return (
                            <button
                              key={z.id}
                              type="button"
                              onClick={() => applyZoom({ x: z.x, y: z.y, width: z.width, height: z.height })}
                              className={`w-full flex items-center gap-2 rounded-lg border-2 px-2 py-1.5 text-left text-xs transition-colors ${
                                isActive ? "border-primary bg-primary/10" : "border-border hover:bg-muted/50"
                              }`}
                            >
                              <span className="h-5 w-5 shrink-0 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                {i + 1}
                              </span>
                              <span className="truncate">{z.label || `Zóna ${i + 1}`}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Tento slide nemá uložené zóny přiblížení. Můžete nakreslit výřez přímo teď.
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant={drawZoomMode ? "default" : "outline"}
                      className="w-full gap-1.5"
                      onClick={() => setDrawZoomMode((v) => !v)}
                    >
                      <Crosshair className="w-4 h-4" />
                      {drawZoomMode ? "Ukončit kreslení výřezu" : "Nakreslit výřez"}
                    </Button>
                    {activeZoom && (
                      <Button size="sm" variant="secondary" className="w-full gap-1.5" onClick={() => applyZoom(null)}>
                        <ZoomOut className="w-4 h-4" /> Zpět na celý slide
                      </Button>
                    )}
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </TooltipProvider>

          {/* Nastavení */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <Settings className="w-4 h-4" />
                Nastavení
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 space-y-3">
              <p className="text-sm font-semibold">Nastavení prezentace</p>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Kreslení žáků do streamu</span>
                <Switch
                  checked={!!settings?.allowStudentDrawSync}
                  onCheckedChange={async (checked) => {
                    if (!sessionId) return;
                    await supabase
                      .from("game_sessions")
                      .update({ settings: { ...(settings || {}), allowStudentDrawSync: checked } })
                      .eq("id", sessionId);
                  }}
                  aria-label="Povolit kreslení žáků do streamu"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Anonymní odpovědi</span>
                <Switch
                  checked={!!settings?.anonymousAnswers}
                  onCheckedChange={async (checked) => {
                    if (!sessionId) return;
                    await supabase
                      .from("game_sessions")
                      .update({ settings: { ...(settings || {}), anonymousAnswers: checked } })
                      .eq("id", sessionId);
                  }}
                  aria-label="Anonymní odpovědi na projektoru"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Tempo: {settings?.pacingMode === "student" ? "vlastní tempo" : "učitelem"}</span>
                <Switch
                  checked={settings?.pacingMode === "student"}
                  onCheckedChange={async (checked) => {
                    if (!sessionId) return;
                    await supabase
                      .from("game_sessions")
                      .update({
                        settings: { ...(settings || {}), pacingMode: checked ? "student" : "teacher" },
                      })
                      .eq("id", sessionId);
                  }}
                  aria-label="Vlastní tempo žáka"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>Závodní dráha</span>
                <Switch
                  checked={!!settings?.showRaceTrack}
                  onCheckedChange={async (checked) => {
                    if (!sessionId) return;
                    await supabase
                      .from("game_sessions")
                      .update({ settings: { ...(settings || {}), showRaceTrack: checked } })
                      .eq("id", sessionId);
                  }}
                  aria-label="Zobrazit závodní dráhu na projektoru"
                />
              </label>
              <GameBackgroundSelect
                value={sessionBackgroundUrl(settings)}
                subjectKey={settings?.subjectKey ?? null}
                onChange={async (url) => {
                  if (!sessionId) return;
                  await supabase
                    .from("game_sessions")
                    .update({ settings: { ...(settings || {}), backgroundUrl: url } })
                    .eq("id", sessionId);
                }}
              />
            </PopoverContent>
          </Popover>

          {/* Nástroje */}
          <Popover>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5 relative">
                <Wrench className="w-4 h-4" />
                Nástroje
                {unansweredCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                    {unansweredCount}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                onClick={() => setAdaptiveOpen(true)}
              >
                <Brain className="w-4 h-4" /> Adaptivní závěr
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                onClick={() => setResultsPanelOpen(true)}
              >
                <BarChart3 className="w-4 h-4" /> Výsledky třídy
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                onClick={() => setProgressGridOpen(true)}
              >
                <LayoutGrid className="w-4 h-4" /> Přehled třídy
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 rounded-sm px-2 py-2 text-sm hover:bg-accent"
                onClick={() => setQuestionsOpen(true)}
              >
                <MessageCircleQuestion className="w-4 h-4" /> Dotazy
                {unansweredCount > 0 && (
                  <span className="ml-auto inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                    {unansweredCount}
                  </span>
                )}
              </button>
            </PopoverContent>
          </Popover>

          <Button size="sm" variant="destructive" onClick={endGame}>
            <StopCircle className="w-4 h-4 mr-1" /> Ukončit
          </Button>
        </div>

      </div>

      {sessionId && (
        <AdaptiveReviewDialog
          open={adaptiveOpen}
          onOpenChange={setAdaptiveOpen}
          sessionId={sessionId}
          slides={slides}
          responses={responses}
          currentSettings={settings}
        />
      )}

      {sessionId && (
        <LiveQuestionsSheet
          open={questionsOpen}
          onOpenChange={setQuestionsOpen}
          sessionId={sessionId}
          role="teacher"
          players={players as any}
          anonymous={!!settings?.anonymousAnswers}
        />
      )}

      <Sheet open={resultsPanelOpen} onOpenChange={setResultsPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Výsledky třídy — celá prezentace</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4">
            {/* Souhrn */}
            <div className="grid grid-cols-3 gap-3">
              <div className="border border-border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{players.length}</p>
                <p className="text-xs text-muted-foreground">žáků</p>
              </div>
              <div className="border border-border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{slides.filter((s: any) => s.type === "activity").length}</p>
                <p className="text-xs text-muted-foreground">aktivit</p>
              </div>
              <div className="border border-border rounded-lg p-3 text-center">
                <p className="text-2xl font-bold">{responses.length}</p>
                <p className="text-xs text-muted-foreground">odpovědí</p>
              </div>
            </div>

            {/* Zvednuté ruce */}
            {(() => {
              const raised = players
                .filter((p: any) => p.hand_raised)
                .sort((a: any, b: any) =>
                  (a.hand_raised_at || "").localeCompare(b.hand_raised_at || "")
                );
              if (raised.length === 0) return null;
              return (
                <div className="border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 rounded-lg p-3">
                  <p className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    ✋ Zvednuté ruce ({raised.length})
                  </p>
                  <ul className="space-y-1">
                    {raised.map((p: any, i: number) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate">
                          <span className="text-muted-foreground mr-1">{i + 1}.</span>
                          {p.nickname}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={async () => {
                            await supabase.rpc("clear_player_hand" as any, { _player_id: p.id });
                          }}
                        >
                          Odbavit
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Průběh třídy při vlastním tempu žáka */}
            {settings?.pacingMode === "student" && slides.length > 0 && (() => {
              const indices = players
                .map((p: any) => (typeof p.student_index === "number" ? p.student_index : 0))
                .filter((n: number) => Number.isFinite(n));
              if (indices.length === 0) return null;
              const avg = indices.reduce((a: number, b: number) => a + b, 0) / indices.length;
              const min = Math.min(...indices);
              const max = Math.max(...indices);
              return (
                <div className="border border-border rounded-lg p-3">
                  <p className="text-sm font-semibold mb-1">Postup třídy (vlastní tempo)</p>
                  <p className="text-xs text-muted-foreground">
                    Průměrně: {Math.round(avg) + 1}/{slides.length} · rozsah {min + 1}–{max + 1}
                  </p>
                </div>
              );
            })()}



            {/* Per-aktivita breakdown */}
            {slides.map((slide: any, idx) => {
              if (slide.type !== "activity") return null;
              const slideResponses = responses.filter(r => r.question_index === idx);
              const avgScore = slideResponses.length > 0
                ? Math.round(slideResponses.reduce((sum, r) => sum + (r.score ?? 0), 0) / slideResponses.length)
                : null;
              const actType = slide.activitySpec?.activityType || slide.activitySpec?.type || "aktivita";
              return (
                <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">Slide {idx + 1}: {slide.projector?.headline || actType}</p>
                      <Badge variant="outline" className="mt-1 text-xs">{actType}</Badge>
                    </div>
                    {avgScore !== null && (
                      <div className="text-right flex-shrink-0">
                        <p className={`text-xl font-bold ${avgScore >= 70 ? "text-green-600" : avgScore >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                          {avgScore}%
                        </p>
                        <p className="text-xs text-muted-foreground">průměr</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">{slideResponses.length} / {players.length} odpovědí</p>
                    {players.length > 0 && (
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.round((slideResponses.length / players.length) * 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    {slideResponses.map(r => {
                      const player = players.find(p => p.id === r.player_id);
                      return (
                        <div key={r.id} className="flex items-center justify-between text-sm">
                          <span>{player?.nickname || "Žák"}</span>
                          <span className={r.is_correct ? "text-green-600 font-medium" : "text-muted-foreground"}>
                            {r.score ?? 0}%
                          </span>
                        </div>
                      );
                    })}
                    {slideResponses.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">Žádné odpovědi</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={() => { goToIndex(idx); setResultsPanelOpen(false); }}
                  >
                    Přejít na slide {idx + 1}
                  </Button>
                </div>
              );
            })}

            {/* Celkový žebříček žáků */}
            <div className="border border-border rounded-lg p-4">
              <p className="font-semibold text-sm mb-3">Žebříček žáků</p>
              <div className="space-y-1">
                {players
                  .map(p => {
                    const playerResponses = responses.filter(r => r.player_id === p.id);
                    const totalScore = playerResponses.reduce((sum, r) => sum + (r.score ?? 0), 0);
                    const avgScore = playerResponses.length > 0 ? Math.round(totalScore / playerResponses.length) : 0;
                    return { ...p, avgScore, answered: playerResponses.length };
                  })
                  .sort((a, b) => b.avgScore - a.avgScore)
                  .map((p, i) => (
                    <div key={p.id} className="flex items-center justify-between text-sm py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground w-6">{i + 1}.</span>
                        <span>{p.nickname}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{p.answered} odpovědí</span>
                        <span className="font-medium w-12 text-right">{p.avgScore}%</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={progressGridOpen} onOpenChange={setProgressGridOpen}>
        <DialogContent className="max-w-6xl w-[95vw]">
          <DialogHeader>
            <DialogTitle>Přehled třídy — mřížka postupu</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            <StudentProgressGrid
              slides={slides as any}
              players={players as any}
              responses={responses as any}
              pacingMode={settings?.pacingMode}
            />
          </div>
        </DialogContent>
      </Dialog>


      {/* Slide strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goToIndex(i)}
            className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-medium cursor-pointer transition-colors ${
              i === currentIndex
                ? "bg-primary text-primary-foreground"
                : i < currentIndex
                ? "bg-muted text-muted-foreground hover:bg-muted/80"
                : "bg-muted/50 text-muted-foreground/50 hover:bg-muted/70"
            }`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {currentSlide && (
        <div className="space-y-4">
          <Badge>{SLIDE_TYPE_LABELS[currentSlide.type] || currentSlide.type}</Badge>

          {/* Živé přiblížení – náhled výřezu + kreslení */}
          {zoomable && (drawZoomMode || activeZoom) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <ZoomIn className="w-4 h-4" />
                  {drawZoomMode ? "Tažením nakreslete výřez" : "Přiblížení aktivní"}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={drawZoomMode ? "default" : "outline"}
                    className="gap-1.5"
                    onClick={() => setDrawZoomMode((v) => !v)}
                  >
                    <Crosshair className="w-3.5 h-3.5" />
                    {drawZoomMode ? "Hotovo" : "Nakreslit výřez"}
                  </Button>
                  {activeZoom && (
                    <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => applyZoom(null)}>
                      <ZoomOut className="w-3.5 h-3.5" /> Zpět na celý slide
                    </Button>
                  )}
                </div>
              </div>
              <div className="relative">
                <div className="overflow-hidden rounded-xl">
                  <div style={drawZoomMode ? undefined : zoomStageStyle(activeZoom)}>
                    <SlideCanvas slide={currentSlide} themeId={(currentSlide as any)?.themeId} darkMode />
                  </div>
                </div>
                <ZoomZoneSurface
                  zones={drawZoomMode ? zoomZones : []}
                  drawing={drawZoomMode}
                  onDraw={(rect) => {
                    applyZoom(rect);
                    setDrawZoomMode(false);
                  }}
                  onZoneClick={(z) => applyZoom({ x: z.x, y: z.y, width: z.width, height: z.height })}
                />
              </div>
            </div>
          )}

          {/* Projector */}
          <div
            ref={projectorPreviewRef}
            onScroll={handleProjectorScroll}
            className="border border-border rounded-lg p-6 bg-background max-h-[60vh] overflow-y-auto"
          >
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground">
              <Monitor className="w-4 h-4" /> PROJEKTOR
            </div>
            <h2 className="text-2xl font-bold">{currentSlide.projector.headline}</h2>
            {(currentSlide as any).blocks && (currentSlide as any).blocks.length > 0 ? (
              <div className="space-y-4 mt-3">
                {(currentSlide as any).blocks.map((b: any, i: number) => (
                  <LessonBlock key={b.id || i} block={b} blockIndex={i} isTeacher />
                ))}
              </div>
            ) : (
              <>
                {!(currentSlide as any).tableData && !(currentSlide as any).cardData && currentSlide.projector.body && (
                  <p className="text-base text-muted-foreground mt-2 whitespace-pre-wrap">{currentSlide.projector.body}</p>
                )}
                {(currentSlide as any).tableData && (
                  <div className="overflow-x-auto mt-3">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          {(currentSlide as any).tableData.headers.map((h: string, i: number) => (
                            <th key={i} className="border border-border bg-muted px-3 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(currentSlide as any).tableData.rows.map((row: string[], ri: number) => (
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
                {(currentSlide as any).cardData && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {(currentSlide as any).cardData.map((card: any, i: number) => (
                      <div key={i} className="border border-border rounded-lg p-3 bg-card">
                        <p className="font-semibold text-sm">{card.title}</p>
                        {card.text && <p className="text-xs text-muted-foreground mt-1">{card.text}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {currentSlide.type === "activity" && (currentSlide as any).activitySpec?.activityType === "teams" && (
            <TeamsSlideTeacher session={session} players={players} />
          )}

          {currentSlide.type === "activity" && (currentSlide as any).activitySpec?.activityType === "differentiated" && (
            <DifferentiatedSlideTeacher session={session} players={players} />
          )}

          {currentSlide.type === "activity" && (currentSlide as any).activitySpec?.activityType === "escape" && (
            <div className="mt-4">
              <EscapeGameOverview slide={currentSlide} />
            </div>
          )}

          {currentSlide.type === "activity" && (currentSlide as any).activitySpec?.activityType !== "teams" && (currentSlide as any).activitySpec?.activityType !== "differentiated" && (currentSlide as any).activitySpec?.activityType !== "escape" && (
            <div className="mt-4 space-y-3">
              <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-sm text-primary font-medium">Žáci plní aktivitu</span>
                  </div>
                  <span className="text-sm font-medium">{responses.filter(r => r.question_index === currentIndex).length} / {players.length} odpovědí</span>
                </div>
                {players.length > 0 && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.round((responses.filter(r => r.question_index === currentIndex).length / players.length) * 100)}%` }}
                    />
                  </div>
                )}
              </div>
              {hasActivityTaskPreview((currentSlide as any).activitySpec) && (
                <div className="p-3 border border-border rounded-lg space-y-2">
                  <p className="text-xs text-muted-foreground">Zadání a řešení</p>
                  <ActivityTaskPreview spec={(currentSlide as any).activitySpec} showSolution />
                </div>
              )}

              {responses.filter(r => r.question_index === currentIndex).length > 0 && (
                <div className="p-3 border border-border rounded-lg">
                  <p className="text-xs text-muted-foreground mb-2">Výsledky třídy</p>
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        {(() => {
                          const relevant = responses.filter(r => r.question_index === currentIndex);
                          if (relevant.length === 0) return 0;
                          const avgScore = relevant.reduce((sum, r) => sum + (r.score ?? 0), 0) / relevant.length;
                          return Math.round(avgScore);
                        })()}%
                      </p>
                      <p className="text-xs text-muted-foreground">správně</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold">{responses.filter(r => r.question_index === currentIndex).length}</p>
                      <p className="text-xs text-muted-foreground">odpovědělo</p>
                    </div>
                  </div>
                  {responses.filter(r => r.question_index === currentIndex).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      <p className="text-xs text-muted-foreground mb-2">Výsledky žáků</p>
                      {responses
                        .filter(r => r.question_index === currentIndex)
                        .map(r => {
                          const player = players.find(p => p.id === r.player_id);
                          return (
                            <div key={r.id} className="flex items-center justify-between text-sm">
                              <span className="text-foreground">{player?.nickname || "Žák"}</span>
                              <span className={r.is_correct ? "text-green-600 font-medium" : "text-muted-foreground"}>
                                {r.score ?? 0} %
                              </span>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              )}

              {(currentSlide as any).activitySpec?.activityType === "wall" && (() => {
                const wallPublished =
                  (settings?.wallPublished === true) &&
                  (settings?.wallPublishedQuestion === currentIndex);
                const anonymous = (currentSlide as any).activitySpec?.anonymous;
                const wallResponses = responses.filter(r => r.question_index === currentIndex);
                return (
                  <div className="mt-3 p-3 border border-border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Zeď odpovědí</p>
                      <Button
                        size="sm"
                        variant={wallPublished ? "default" : "outline"}
                        onClick={async () => {
                          if (!sessionId) return;
                          await supabase.from("game_sessions").update({
                            settings: {
                              ...(settings || {}),
                              wallPublished: !wallPublished,
                              wallPublishedQuestion: currentIndex,
                            },
                          }).eq("id", sessionId);
                        }}
                        className="gap-1.5"
                      >
                        {wallPublished ? "✓ Odpovědi zobrazeny" : "Zveřejnit odpovědi"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={settings?.wallAnonymous ?? (currentSlide as any).activitySpec?.anonymous ?? false}
                          onCheckedChange={async (v) => {
                            if (!sessionId) return;
                            await supabase.from("game_sessions").update({
                              settings: { ...(settings || {}), wallAnonymous: v }
                            }).eq("id", sessionId);
                          }}
                          id="live-wall-anonymous"
                        />
                        <Label htmlFor="live-wall-anonymous" className="text-xs cursor-pointer">
                          Anonymní
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={settings?.wallAllowMultiple ?? (currentSlide as any).activitySpec?.allowMultiple ?? false}
                          onCheckedChange={async (v) => {
                            if (!sessionId) return;
                            await supabase.from("game_sessions").update({
                              settings: { ...(settings || {}), wallAllowMultiple: v }
                            }).eq("id", sessionId);
                          }}
                          id="live-wall-multiple"
                        />
                        <Label htmlFor="live-wall-multiple" className="text-xs cursor-pointer">
                          Více odpovědí
                        </Label>
                      </div>
                    </div>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {wallResponses.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Zatím žádné odpovědi.</p>
                      ) : (
                        wallResponses.map(r => {
                          const player = players.find(p => p.id === r.player_id);
                          return (
                            <div key={r.id} className="flex items-start gap-2 text-sm p-2 bg-muted rounded">
                              {!anonymous && <span className="font-medium text-primary flex-shrink-0">{player?.nickname || "Žák"}:</span>}
                              <span className="text-muted-foreground">{(r.answer as any)?.text || "—"}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <AiClusterButton
                      texts={wallResponses.map(r => String((r.answer as any)?.text || "").trim()).filter(Boolean)}
                      question={(currentSlide as any).activitySpec?.question}
                    />
                  </div>
                );
              })()}


              {(currentSlide as any).activitySpec?.activityType === "poll" && (() => {
                const pollPublished =
                  (settings?.pollPublished === true) &&
                  (settings?.pollPublishedQuestion === currentIndex);
                const spec = (currentSlide as any).activitySpec || {};
                const options = Array.isArray(spec.options) ? spec.options : [];
                const question = spec.question || "";
                return (
                  <div className="mt-3 p-3 border border-border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Hlasování</p>
                      <Button
                        size="sm"
                        variant={pollPublished ? "default" : "outline"}
                        onClick={async () => {
                          if (!sessionId) return;
                          await supabase.from("game_sessions").update({
                            settings: {
                              ...(settings || {}),
                              pollPublished: !pollPublished,
                              pollPublishedQuestion: currentIndex,
                            },
                          }).eq("id", sessionId);
                        }}
                        className="gap-1.5"
                      >
                        {pollPublished ? "✓ Výsledky zobrazeny" : "Zveřejnit výsledky"}
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={settings?.pollAllowMultiple ?? spec.allowMultiple ?? false}
                        onCheckedChange={async (v) => {
                          if (!sessionId) return;
                          await supabase.from("game_sessions").update({
                            settings: { ...(settings || {}), pollAllowMultiple: v }
                          }).eq("id", sessionId);
                        }}
                        id="live-poll-multiple"
                      />
                      <Label htmlFor="live-poll-multiple" className="text-xs cursor-pointer">
                        Povolit více odpovědí
                      </Label>
                    </div>
                    {sessionId && options.length > 0 && (
                      <div className="border border-border rounded-md p-3 bg-card">
                        <PollProjectorView
                          question={question}
                          options={options}
                          sessionId={sessionId}
                          questionIndex={currentIndex}
                          totalPlayers={players.length}
                        />
                      </div>
                    )}
                  </div>
                );
              })()}

              {(currentSlide as any).activitySpec?.activityType === "wordcloud" && (() => {
                const wcPublished =
                  (settings?.wordcloudPublished === true) &&
                  (settings?.wordcloudPublishedQuestion === currentIndex);
                return (
                  <div className="mt-3 p-3 border border-border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Slovní mrak</p>
                      <Button
                        size="sm"
                        variant={wcPublished ? "default" : "outline"}
                        onClick={async () => {
                          if (!sessionId) return;
                          await supabase.from("game_sessions").update({
                            settings: {
                              ...(settings || {}),
                              wordcloudPublished: !wcPublished,
                              wordcloudPublishedQuestion: currentIndex,
                            },
                          }).eq("id", sessionId);
                        }}
                        className="gap-1.5"
                      >
                        {wcPublished ? "✓ Mrak zobrazen" : "Zveřejnit mrak"}
                      </Button>
                    </div>
                    {sessionId && (
                      <div className="border border-border rounded-md p-3 bg-card">
                        <WordCloudView
                          sessionId={sessionId}
                          questionIndex={currentIndex}
                          published={true}
                        />
                      </div>
                    )}
                    <AiClusterButton
                      texts={responses
                        .filter(r => r.question_index === currentIndex)
                        .map(r => String((r.answer as any)?.text || "").trim())
                        .filter(Boolean)}
                      question={(currentSlide as any).activitySpec?.question}
                      label="AI shrnutí pojmů"
                    />
                  </div>
                );
              })()}

            </div>
          )}

          {/* Device preview */}
          <div className="border border-border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
              <Smartphone className="w-4 h-4" /> ZAŘÍZENÍ ŽÁKA
            </div>
            <p className="text-sm whitespace-pre-wrap">{currentSlide.device.instructions}</p>
          </div>

          {/* Teacher notes (blokový model: teacherNotes, AI plány: speakerNotes) */}
          {(currentSlide.teacherNotes || (currentSlide as any).speakerNotes) && (
            <div className="border border-dashed border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1 text-xs font-medium text-muted-foreground">
                <StickyNote className="w-3.5 h-3.5" /> POZNÁMKY
              </div>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                {currentSlide.teacherNotes || (currentSlide as any).speakerNotes}
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              disabled={currentIndex <= 0}
              onClick={() => {
                if (currentIndex > 0) {
                  // Go back by setting index manually
                  nextQuestion(currentIndex - 2);
                }
              }}
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Předchozí
            </Button>
            {hasRevealBlocks && revealStep < maxRevealCount && (
              <Button variant="secondary" onClick={revealNext} className="gap-1.5">
                <Eye className="w-4 h-4" />
                Odkrýt další ({Math.min(revealStep, maxRevealCount)}/{maxRevealCount})
              </Button>
            )}
            <Button onClick={handleNext}>
              {currentIndex >= slides.length - 1 ? "Ukončit výuku" : "Další slide"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>

    {sessionId && whiteboardVisible && currentSlide && (
      <div className="fixed inset-0 z-40 overflow-auto">
        <ProjectorSlideView
          sessionId={sessionId}
          session={session}
          currentSlide={currentSlide}
          currentIndex={currentIndex}
          slides={slides}
          players={players}
          gameCode={gameCode}
          zoom={activeZoom}
          overlayContent={(
            <LiveWhiteboard
              sessionId={sessionId}
              data={whiteboard}
              slideIndex={currentIndex}
              onClose={toggleWhiteboard}
            />
          )}
        />
      </div>
    )}

    {sessionId && (
      <>
        <Button
          onClick={() => setAddSlideOpen(true)}
          aria-label="Přidat slide"
          title="Přidat slide"
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all p-0"
        >
          <Plus className="w-6 h-6" />
        </Button>
        <AddSlideSheet
          open={addSlideOpen}
          onOpenChange={setAddSlideOpen}
          sessionId={sessionId}
          slides={slides}
        />
      </>
    )}
    </>
  );
};

export default LiveTeacherScreen;

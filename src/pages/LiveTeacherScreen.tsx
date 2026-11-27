import { useParams, useNavigate } from "react-router-dom";
import { useGameSession, useTeacherGameControls } from "@/hooks/useGameSession";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { GameLobby } from "@/components/game/GameLobby";
import ActivityTaskPreview, { hasActivityTaskPreview } from "@/components/live/ActivityTaskPreview";
import { correctResponsePercent, formatResponsePoints } from "@/lib/live-question-results";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { isLiveMcqSlide, isMcqRevealed, mcqRevealPatch, liveQuestionTimeLimitMs } from "@/lib/live-mcq";
import { serverTsToClientMs } from "@/lib/clock-sync";
import StartActivityPanel from "@/components/live/StartActivityPanel";
import { isAwaitingStart, isManualStart, isRespondableSlide, settingsForSlideEnter, settingsForStart } from "@/lib/live-timing";
import { nextAnimationRevealCount, pendingClickActivity, slideClickAnimations } from "@/lib/slide-block-animations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, ChevronLeft, ChevronRight, Users, StopCircle, ArrowLeft, Plus, Eye, ZoomIn, ZoomOut, Crosshair, Copy, MoreHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { LobbySettingsSection } from "@/components/live/LobbySettingsSection";
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
import RaisedHandsIndicator from "@/components/game/RaisedHandsIndicator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import PollProjectorView from "@/components/activities/PollProjectorView";
import WordCloudView from "@/components/activities/WordCloudView";
import { isWordcloudShown } from "@/lib/wordcloud-visibility";
import { pollOptionId } from "@/lib/poll-options";
import LiveWhiteboard, { WhiteboardData } from "@/components/game/LiveWhiteboard";
import RemoteControlButton from "@/components/live/RemoteControlButton";
import { presenterRemoteChannelName } from "@/pages/PresenterRemote";
import { decideRemoteActivityCmd, remoteActivityState } from "@/lib/remote-activity";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import { useSwipe } from "@/hooks/useSwipe";
import { GAME_MODES, getModeDef, type GameMode } from "@/lib/game-modes";
import type { TeamMode } from "@/lib/game-types";
import { useTeamAutoAssign } from "@/hooks/useTeamAutoAssign";
import { TeamSetup } from "@/components/game/TeamSetup";
import AiClusterButton from "@/components/live/AiClusterButton";
import ZoomZoneSurface from "@/components/live/ZoomZoneSurface";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { slideWithFallbackBlocks } from "@/lib/slide-canvas-fallback";
import LiveDraftsPanel from "@/components/live/LiveDraftsPanel";
import LessonPlanPacing from "@/components/live/LessonPlanPacing";
import LiveSlideTopNav, { isTypingTarget, slideKeyDirection } from "@/components/live/LiveSlideTopNav";
import LiveTeacherActions from "@/components/live/LiveTeacherActions";
import TeacherNotesPanel from "@/components/live/TeacherNotesPanel";
import type { ClassroomToolRequest } from "@/components/classroom/ClassroomToolsOverlay";
import { getZoomZones, isValidZoomRect, isZoomableSlide, zoomStageStyle, type ZoomRect } from "@/lib/zoom-zones";
import { clampProjectorFontScale, loadProjectorFontScale, saveProjectorFontScale, settingsWithProjectorFontScale } from "@/lib/projector-font-scale";
import { isSoloRoundSlide } from "@/lib/solo-round";
import { loadTeacherNotesCollapsed, patchTeacherNotes, saveTeacherNotesCollapsed, teacherNotesForSlide, type TeacherNoteTarget } from "@/lib/live-teacher-notes";
import { useToast } from "@/hooks/use-toast";

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
  const { toast } = useToast();
  const [fetchAttempts, setFetchAttempts] = useState(0);
  const { session, players, responses, loading, connectionStatus, reconnect } = useGameSession(sessionId, fetchAttempts);
  const { startGame, nextQuestion, showResults, endGame } = useTeacherGameControls(sessionId);
  const [adaptiveOpen, setAdaptiveOpen] = useState(false);
  const [addSlideOpen, setAddSlideOpen] = useState(false);
  const [resultsPanelOpen, setResultsPanelOpen] = useState(false);
  const [progressGridOpen, setProgressGridOpen] = useState(false);
  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [teamsDialogOpen, setTeamsDialogOpen] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [notesMobileOpen, setNotesMobileOpen] = useState(false);
  const [notesCollapsed, setNotesCollapsed] = useState(false);
  const [classroomTool, setClassroomTool] = useState<ClassroomToolRequest | null>(null);
  const [compactActions, setCompactActions] = useState(() => typeof window !== "undefined" && window.innerWidth < 1280);
  const notesSaveQueueRef = useRef<Promise<void>>(Promise.resolve());
  useTeamAutoAssign(session as any, players as any);
  const projectorPreviewRef = useRef<HTMLDivElement>(null);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const slides: SlideData[] = (session?.activity_data as any[]) || [];
  const currentIndex = session?.current_question_index ?? -1;
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const isLobby = session?.status === "lobby";
  const isFinished = session?.status === "finished";
  const settings = session?.settings as any;
  const teacherId = (session as any)?.teacher_id as string | undefined;
  const [projectorFontScale, setProjectorFontScale] = useState(loadProjectorFontScale);
  const fontScaleInitializedFor = useRef<string | null>(null);
  const gameCode = session?.game_code || "";
  const whiteboard: WhiteboardData = ((session as any)?.whiteboard_data as WhiteboardData) ?? { visible: false, strokesBySlide: {} };
  const whiteboardVisible = whiteboard.visible;
  const { unansweredCount } = useLiveQuestions(sessionId);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const update = () => setCompactActions(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    setNotesCollapsed(loadTeacherNotesCollapsed(teacherId));
  }, [teacherId]);

  const changeNotesCollapsed = useCallback((collapsed: boolean) => {
    setNotesCollapsed(collapsed);
    saveTeacherNotesCollapsed(teacherId, collapsed);
  }, [teacherId]);

  const changeProjectorFontScale = useCallback(async (value: number) => {
    const next = saveProjectorFontScale(value);
    setProjectorFontScale(next);
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      settings: settingsWithProjectorFontScale(settings, next) as any,
    }).eq("id", sessionId);
  }, [sessionId, settings]);

  const updateSessionSettings = useCallback(async (patch: Record<string, any>) => {
    if (!sessionId) return;
    const next = { ...(settings || {}), ...patch };
    // Původní chování ručního spouštění: vypnutí klíč odstraní, nikoli ukládá null.
    if (patch.armedQuestion === null) delete next.armedQuestion;
    await supabase.from("game_sessions").update({ settings: next }).eq("id", sessionId);
  }, [sessionId, settings]);

  const requestEndGame = useCallback(() => {
    if (!window.confirm("Opravdu chcete ukončit výuku? Žákům se zobrazí závěrečná obrazovka.")) return;
    void endGame();
  }, [endGame]);

  const copyGameCode = useCallback(async () => {
    if (!gameCode) return;
    try {
      await navigator.clipboard.writeText(gameCode);
      toast({ title: "Kód zkopírován", description: gameCode });
    } catch {
      toast({ title: "Kód se nepodařilo zkopírovat", description: "Označte jej a zkopírujte ručně.", variant: "destructive" });
    }
  }, [gameCode, toast]);

  const noteTarget = useMemo<TeacherNoteTarget>(() => ({
    slideId: currentSlide?.slideId,
    index: Math.max(0, currentIndex),
  }), [currentSlide?.slideId, currentIndex]);

  /** Čte čerstvou řadu a mění jen poznámku cílového slidu; souběžný zápis se nepřepíše. */
  const saveTeacherNotes = useCallback((target: TeacherNoteTarget, notes: string) => {
    const run = async () => {
      if (!sessionId) throw new Error("Chybí relace");
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const { data: fresh, error: readError } = await supabase
          .from("game_sessions")
          .select("activity_data, updated_at")
          .eq("id", sessionId)
          .single();
        if (readError) throw readError;
        const latestSlides = Array.isArray(fresh?.activity_data) ? fresh.activity_data as any[] : [];
        const activityData = patchTeacherNotes(latestSlides, target, notes);
        if (!activityData) throw new Error("Slide už v prezentaci není");
        let update = supabase.from("game_sessions").update({ activity_data: activityData as any }).eq("id", sessionId);
        if (fresh?.updated_at) update = update.eq("updated_at", fresh.updated_at);
        const { data: saved, error: updateError } = await update.select("id");
        if (updateError) throw updateError;
        if (saved && saved.length === 0 && fresh?.updated_at) continue;
        return;
      }
      throw new Error("Prezentace se právě změnila, zkuste uložení znovu");
    };
    const queued = notesSaveQueueRef.current.catch(() => {}).then(run);
    notesSaveQueueRef.current = queued;
    return queued;
  }, [sessionId]);

  // Starší relace bez hodnoty dostanou uloženou učitelovu volbu; novější
  // projektor i učitel sdílí jedinou hodnotu v existujícím settings JSON.
  useEffect(() => {
    if (!sessionId || !session) return;
    if (settings?.projectorFontScale != null) {
      const next = saveProjectorFontScale(settings.projectorFontScale);
      setProjectorFontScale(next);
      fontScaleInitializedFor.current = sessionId;
      return;
    }
    if (fontScaleInitializedFor.current === sessionId) return;
    fontScaleInitializedFor.current = sessionId;
    const next = saveProjectorFontScale(projectorFontScale);
    void (async () => {
      await supabase.from("game_sessions").update({
        settings: settingsWithProjectorFontScale(settings, next) as any,
      }).eq("id", sessionId);
    })();
  }, [sessionId, session, settings, projectorFontScale]);

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

  // ---- MCQ: zveřejnění výsledků otázky (ručně / všichni odpověděli / vypršel čas) ----
  const clickAnimations = slideClickAnimations(currentSlide);
  const animationRevealCount = typeof settings?.animationRevealCount === "number" ? settings.animationRevealCount : 0;
  const animationAwaitingReveal = pendingClickActivity(currentSlide, animationRevealCount);
  const awaitingStart = session?.status === "playing" && (isAwaitingStart(settings, currentSlide, currentIndex) || animationAwaitingReveal);
  const mcqActive = isLiveMcqSlide(currentSlide) && session?.status === "playing" && !awaitingStart;
  const mcqRevealed = isMcqRevealed(settings, currentIndex);
  const revealMcq = useCallback(async () => {
    if (!sessionId || currentIndex < 0) return;
    await supabase.from("game_sessions").update(mcqRevealPatch(settings, currentIndex) as any).eq("id", sessionId);
  }, [sessionId, settings, currentIndex]);
  const mcqAnswered = responses.filter(r => r.question_index === currentIndex).length;
  useEffect(() => {
    if (!mcqActive || mcqRevealed) return;
    if (players.length > 0 && mcqAnswered >= players.length) void revealMcq();
  }, [mcqActive, mcqRevealed, mcqAnswered, players.length, revealMcq]);
  useEffect(() => {
    if (!mcqActive || mcqRevealed || !session?.question_started_at) return;
    const limit = liveQuestionTimeLimitMs(settings, currentSlide);
    if (!limit) return;
    const wait = serverTsToClientMs(session.question_started_at) + limit - Date.now();
    const id = setTimeout(() => void revealMcq(), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [mcqActive, mcqRevealed, session?.question_started_at, settings?.timePerQuestion, currentSlide, revealMcq]);

  // Samostatné kolo (mimo vlastní tempo Závodu): společný konec po všech nebo po čase.
  const soloActive = isSoloRoundSlide(currentSlide) && session?.status === "playing" && !awaitingStart && settings?.gameMode !== "race";
  const soloAnswered = responses.filter((r) => r.question_index === currentIndex).length;
  useEffect(() => {
    if (!soloActive || players.length === 0 || soloAnswered < players.length) return;
    void showResults();
  }, [soloActive, soloAnswered, players.length, showResults]);
  useEffect(() => {
    if (!soloActive || !session?.question_started_at) return;
    const limit = liveQuestionTimeLimitMs(settings, currentSlide);
    if (!limit) return;
    const wait = serverTsToClientMs(session.question_started_at) + limit - Date.now();
    const id = setTimeout(() => void showResults(), Math.max(0, wait));
    return () => clearTimeout(id);
  }, [soloActive, session?.question_started_at, settings?.timePerQuestion, currentSlide, showResults]);

  // ---- Ruční „Spustit“: odpovídání a odpočet začnou až teď ----
  const startActivity = useCallback(async () => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      settings: settingsForStart(settings) as any,
      question_started_at: new Date().toISOString(),
    }).eq("id", sessionId);
  }, [sessionId, settings]);

  // Zveřejnění výsledků – sdílí tlačítka na obrazovce i dálkové ovládání (stejný zápis do settings).
  const toggleWallPublished = useCallback(async (published: boolean) => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      settings: { ...(settings || {}), wallPublished: !published, wallPublishedQuestion: currentIndex },
    }).eq("id", sessionId);
  }, [sessionId, settings, currentIndex]);
  const togglePollPublished = useCallback(async (published: boolean) => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      settings: { ...(settings || {}), pollPublished: !published, pollPublishedQuestion: currentIndex },
    }).eq("id", sessionId);
  }, [sessionId, settings, currentIndex]);

  const toggleWordcloudPublished = useCallback(async (published: boolean) => {
    if (!sessionId) return;
    await supabase.from("game_sessions").update({
      settings: { ...(settings || {}), wordcloudPublished: !published, wordcloudPublishedQuestion: currentIndex },
    }).eq("id", sessionId);
  }, [sessionId, settings, currentIndex]);

  // Dálkové „start“/„publish“: vždy nad aktuálním stavem (ref), ignoruje neaktivitu a opakování.
  const remoteActivityRef = useRef<(cmd: string) => void>(() => {});
  remoteActivityRef.current = (cmd: string) => {
    const action = decideRemoteActivityCmd(cmd, remoteActivityState(currentSlide, settings, currentIndex, session?.status));
    if (!action) return;
    if (action.type === "start") void startActivity();
    else if (action.kind === "mcq") void revealMcq();
    else if (action.kind === "poll") void togglePollPublished(false);
    else if (action.kind === "wall") void toggleWallPublished(false);
    else if (action.kind === "wordcloud") void toggleWordcloudPublished(false);
  };

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
  // (reset v DB se posílá rovnou se změnou snímku — viz slideResetPatch)
  useEffect(() => {
    if (!sessionId) return;
    setDrawZoomMode(false);
    if (projectorPreviewRef.current) {
      projectorPreviewRef.current.scrollTop = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  /** Reset posunu/odhalení/přiblížení, posílaný ve stejném zápisu jako změna snímku. */
  const slideResetPatch = useCallback((target: number) => ({
    settings: { ...settingsForSlideEnter(settings, slides, target), projectorScrollTop: 0, revealStep: 1, animationRevealCount: 0 },
    zoom_state: null,
  }), [settings, slides]);

  const handleNext = useCallback(() => {
    if (!session) return;
    if (animationRevealCount < clickAnimations.length) {
      const next = nextAnimationRevealCount(currentSlide, animationRevealCount);
      const revealsActivity = clickAnimations.slice(animationRevealCount, next).some((item) => item.isActivity);
      void supabase.from("game_sessions").update({
        settings: { ...(settings || {}), animationRevealCount: next },
        ...(revealsActivity && !isManualStart(settings) ? { question_started_at: new Date().toISOString() } : {}),
      }).eq("id", sessionId).then(({ error }) => { if (error) console.error("Odhalení animace se neuložilo:", error.message); });
      return;
    }
    if (currentIndex >= slides.length - 1) {
      requestEndGame();
    } else {
      nextQuestion(currentIndex, slideResetPatch(currentIndex + 1));
    }
  }, [session, sessionId, settings, currentSlide, animationRevealCount, clickAnimations, currentIndex, slides.length, nextQuestion, requestEndGame, slideResetPatch]);

  const goToIndex = useCallback(async (target: number) => {
    if (!sessionId) return;
    if (target < 0 || target >= slides.length) return;
    await supabase.from("game_sessions").update({
      ...slideResetPatch(target),
      current_question_index: target,
      question_started_at: new Date().toISOString(),
      status: "playing",
    }).eq("id", sessionId);
  }, [sessionId, slides.length, slideResetPatch]);

  const swipeHandlers = useSwipe({
    onSwipeLeft: () => { if (currentIndex < slides.length - 1) handleNext(); },
    onSwipeRight: () => { if (currentIndex > 0) nextQuestion(currentIndex - 2, slideResetPatch(currentIndex - 1)); },
  });

  const goPrevSlide = useCallback(() => {
    if (animationRevealCount > 0 && clickAnimations.length > 0) {
      void supabase.from("game_sessions").update({ settings: { ...(settings || {}), animationRevealCount: Math.max(0, animationRevealCount - 1) } }).eq("id", sessionId);
      return;
    }
    if (currentIndex > 0) nextQuestion(currentIndex - 2, slideResetPatch(currentIndex - 1));
  }, [sessionId, settings, animationRevealCount, clickAnimations.length, currentIndex, nextQuestion, slideResetPatch]);
  const goNextSlide = useCallback(() => {
    if (currentIndex < slides.length - 1) handleNext();
  }, [currentIndex, slides.length, handleNext]);

  // Klávesy: šipky a PageUp/PageDown (ovladače prezentací); při psaní do polí se ignorují.
  useEffect(() => {
    if (session?.status !== "playing") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (document.querySelector("[role='dialog']")) return;
      const dir = slideKeyDirection(e.key);
      if (!dir) return;
      e.preventDefault();
      if (dir > 0) goNextSlide(); else goPrevSlide();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [session?.status, goNextSlide, goPrevSlide]);

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
      if (cmd === "start" || cmd === "publish") remoteActivityRef.current(cmd);
      else if (cmd === "next") handleNext();
      else if (cmd === "prev") {
        if (currentIndex > 0) nextQuestion(currentIndex - 2, slideResetPatch(currentIndex - 1));
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
  }, [sessionId, handleNext, nextQuestion, endGame, currentIndex, goToIndex, settings, slideResetPatch]);

  // Čekárna bývá dlouhá; po zahájení nesmí staré rolování zakrýt vrchol plátna.
  useEffect(() => {
    if (session?.status === "playing") window.scrollTo({ top: 0, left: 0 });
  }, [session?.status]);

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
      if (sessionId && gameMode !== "race" && isManualStart(settings) && isRespondableSlide(slides[0])) {
        // První slide je aktivita a hra se spouští ručně: připravit ho na „Spustit“.
        const { data: fresh } = await supabase.from("game_sessions").select("settings").eq("id", sessionId).maybeSingle();
        await supabase.from("game_sessions").update({
          settings: settingsForSlideEnter((fresh as any)?.settings ?? settings, slides, 0) as any,
        }).eq("id", sessionId);
      }
      startGame();
    };
    // Mixed presentation (výklad + aktivity): no mandatory game-mode picker.
    // Session defaults to 'standard' without teams; individual activity slides
    // can override via slide.gameSettings.
    const mixed = isMixedPresentation(slides);

    return (
      <>
        <RaisedHandsIndicator players={players as any} />
        <GameLobby session={session} players={players} onStart={wrappedStart} isTeacher settingsSlot={!mixed ? (
        <LobbySettingsSection
          title="Herní režim"
          summary={`${currentModeDef.name} · ${teamKind === "none" ? "Bez týmů" : teamKind === "random" ? "Náhodné týmy" : "Ruční týmy"}`}
        >
        {(closeSettings) => (<>

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
                    onClick={() => { setGameMode(m.id); closeSettings(); }}
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
                <span className="text-[11px] text-muted-foreground ml-2">Body týmu = průměr na člena</span>
              </div>
            )}
          </div>
        </>)}
        </LobbySettingsSection>
        ) : undefined} />
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

  const renderTeacherActions = (compact: boolean) => sessionId ? (
    <LiveTeacherActions
      sessionId={sessionId}
      settings={settings || {}}
      currentIndex={currentIndex}
      slidesCount={slides.length}
      projectorFontScale={projectorFontScale}
      onProjectorFontScaleChange={changeProjectorFontScale}
      whiteboardVisible={whiteboardVisible}
      onToggleWhiteboard={toggleWhiteboard}
      zoomable={zoomable}
      zoomZones={zoomZones}
      activeZoom={activeZoom}
      drawZoomMode={drawZoomMode}
      onDrawZoomModeChange={setDrawZoomMode}
      onApplyZoom={applyZoom}
      unansweredCount={unansweredCount}
      onAdaptiveOpen={() => setAdaptiveOpen(true)}
      onResultsOpen={() => setResultsPanelOpen(true)}
      onProgressOpen={() => setProgressGridOpen(true)}
      onQuestionsOpen={() => setQuestionsOpen(true)}
      classroomTool={classroomTool}
      onClassroomToolChange={setClassroomTool}
      onNotesOpen={() => {
        setMoreActionsOpen(false);
        if (compact) window.setTimeout(() => setNotesMobileOpen(true), 300);
        else changeNotesCollapsed(!notesCollapsed);
      }}
      onUpdateSettings={updateSessionSettings}
      compact={compact}
    />
  ) : null;

  // Playing: show current slide
  return (
    <>
    <RaisedHandsIndicator players={players as any} />
    <ConnectionStatusBanner status={connectionStatus} onReconnect={reconnect} />
    <div className="min-h-dvh bg-deck-cream/25 font-deck-body" {...swipeHandlers}>
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 shadow-sm backdrop-blur">
        <div className="flex h-[55px] items-center gap-1.5 px-2 sm:px-3">
          <Button size="icon" variant="ghost" onClick={() => navigate("/ucitel/ucebnice")} className="h-11 w-11 shrink-0 lg:h-9 lg:w-9" aria-label="Zpět do učebnice" title="Zpět do učebnice">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-deck-heading text-sm uppercase tracking-wide text-deck-violet-deep lg:text-base" title={session.title}>{session.title}</h1>
            <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
              <button type="button" onClick={() => void copyGameCode()} className="flex min-h-6 items-center gap-1 rounded px-1 font-mono font-semibold text-foreground hover:bg-muted" title="Kopírovat kód" aria-label={`Kopírovat kód ${gameCode}`}>
                {gameCode}<Copy className="h-3 w-3" />
              </button>
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{players.length}</span>
            </div>
          </div>
          <LiveSlideTopNav
            index={currentIndex}
            total={slides.length}
            onPrev={goPrevSlide}
            onNext={goNextSlide}
            typeLabel={currentSlide ? (SLIDE_TYPE_LABELS[currentSlide.type] || currentSlide.type) : undefined}
          />
          {!compactActions ? (
            <div className="ml-1 flex shrink-0 items-center">{renderTeacherActions(false)}</div>
          ) : (
            <>
              <Button type="button" size="icon" variant="outline" className="h-11 w-11 shrink-0" onClick={() => setMoreActionsOpen(true)} aria-label="Více akcí" title="Více akcí">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
              <Sheet open={moreActionsOpen} onOpenChange={setMoreActionsOpen}>
                <SheetContent side="right" className="w-[min(92vw,22rem)] overflow-y-auto sm:max-w-sm">
                  <SheetHeader><SheetTitle>Více akcí</SheetTitle></SheetHeader>
                  <div className="mt-4">{renderTeacherActions(true)}</div>
                </SheetContent>
              </Sheet>
            </>
          )}
          <Button type="button" size="icon" variant="destructive" onClick={requestEndGame} className="h-11 w-11 shrink-0 lg:h-9 lg:w-9" aria-label="Ukončit výuku" title="Ukončit výuku">
            <StopCircle className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1800px] items-stretch gap-4 p-3 lg:p-4">
        <div className="min-w-0 flex-1 space-y-4">
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


      {currentSlide && (
        <div className="space-y-4">

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
                    <SlideCanvas slide={currentSlide} themeId={(currentSlide as any)?.themeId} darkMode showCorrectAnswers={false} projectorFontScale={projectorFontScale} />
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

          {/* Plátno využije dostupnou šířku i výšku okna; na mobilu drží 16:9. */}
          <div className="aspect-video w-full lg:aspect-auto lg:h-[calc(100dvh-7.5rem)] lg:min-h-[320px]">
            <div ref={projectorPreviewRef} onScroll={handleProjectorScroll} className="h-full w-full overflow-hidden rounded-xl border border-border bg-background">
              <SlideCanvas
                slide={slideWithFallbackBlocks(currentSlide)}
                themeId={(currentSlide as any)?.themeId}
                darkMode
                showCorrectAnswers={false}
                projectorFontScale={projectorFontScale}
                allowContentScroll
                contentScrollTop={Number(settings?.projectorScrollTop) || 0}
                onContentScroll={handleProjectorScroll}
              />
            </div>
          </div>

          <nav aria-label="Přejít na slide" className="flex gap-1 overflow-x-auto pb-1">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToIndex(i)}
                aria-label={`Přejít na slide ${i + 1}`}
                aria-current={i === currentIndex ? "page" : undefined}
                className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded text-xs font-medium transition-colors lg:h-9 lg:w-9 ${
                  i === currentIndex ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </nav>

          {/* Časování podle plánu hodiny zůstává učiteli pod plátnem. */}
          <LessonPlanPacing
            teacherId={teacherId}
            sessionTitle={session?.title}
            currentIndex={currentIndex}
            slideCount={slides.length}
          />


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

          {currentSlide.type === "activity" && !isSoloRoundSlide(currentSlide) && (currentSlide as any).activitySpec?.activityType !== "teams" && (currentSlide as any).activitySpec?.activityType !== "differentiated" && (currentSlide as any).activitySpec?.activityType !== "escape" && (
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
                          return correctResponsePercent(relevant);
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
                                {formatResponsePoints(r.score)}
                              </span>
                            </div>
                          );
                        })
                      }
                    </div>
                  )}
                </div>
              )}

              {isLiveMcqSlide(currentSlide) && (() => {
                const revealed = isMcqRevealed(settings, currentIndex);
                const answered = responses.filter(r => r.question_index === currentIndex).length;
                return (
                  <div className="mt-3 p-3 border border-border rounded-lg flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Výsledky otázky</p>
                      <p className="text-xs text-muted-foreground">
                        {revealed
                          ? "Žáci vidí správnou odpověď."
                          : `Odpovědělo ${answered}/${players.length}. Zveřejní se samo, až odpoví všichni nebo vyprší čas.`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant={revealed ? "default" : "outline"}
                      disabled={revealed}
                      onClick={revealMcq}
                    >
                      {revealed ? "✓ Výsledky zveřejněny" : "Zveřejnit výsledky"}
                    </Button>
                  </div>
                );
              })()}

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
                        onClick={() => toggleWallPublished(wallPublished)}
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
                const options = (Array.isArray(spec.options) ? spec.options : []).map(
                  (option: any, index: number) => ({ ...option, id: pollOptionId(option, index) }),
                );
                const question = spec.question || "";
                return (
                  <div className="mt-3 p-3 border border-border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Hlasování</p>
                      <Button
                        size="sm"
                        variant={pollPublished ? "default" : "outline"}
                        onClick={() => togglePollPublished(pollPublished)}
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
                const wcPublished = isWordcloudShown(settings, currentIndex);
                return (
                  <div className="mt-3 p-3 border border-border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">Slovní mrak</p>
                      <Button
                        size="sm"
                        variant={wcPublished ? "default" : "outline"}
                        onClick={() => toggleWordcloudPublished(wcPublished)}
                        className="gap-1.5"
                        aria-pressed={wcPublished}
                      >
                        {wcPublished ? "Skrýt mrak" : "Zobrazit mrak"}
                      </Button>
                    </div>
                    {sessionId && (
                      <div className="border border-border rounded-md p-3 bg-card">
                        <WordCloudView
                          sessionId={sessionId}
                          questionIndex={currentIndex}
                          published={true}
                          colors={(currentSlide as any).activitySpec?.colors}
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

          {/* Device preview – jen když snímek má pokyn pro zařízení žáka */}
          {(currentSlide as any).device?.instructions && (
            <div className="border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-center gap-2 mb-2 text-xs font-medium text-muted-foreground">
                <Smartphone className="w-4 h-4" /> ZAŘÍZENÍ ŽÁKA
              </div>
              <p className="text-sm whitespace-pre-wrap">{(currentSlide as any).device.instructions}</p>
            </div>
          )}


          {awaitingStart && (
            <StartActivityPanel slide={currentSlide} playerCount={players.length} onStart={startActivity} />
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-border">
            <Button
              variant="outline"
              disabled={currentIndex <= 0}
              onClick={() => {
                if (currentIndex > 0) {
                  // Go back by setting index manually
                  nextQuestion(currentIndex - 2, slideResetPatch(currentIndex - 1));
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
            {(settings?.teamModeKind ?? "none") !== "none" && (
              <Button variant="outline" onClick={() => setTeamsDialogOpen(true)} className="gap-1.5">
                <Users className="w-4 h-4" /> Upravit týmy
              </Button>
            )}
            {isSoloRoundSlide(currentSlide) && session?.status === "playing" && !awaitingStart && settings?.gameMode !== "race" ? (
              <Button onClick={() => void showResults()}>Ukončit kolo a ukázat výsledky</Button>
            ) : (
              <Button onClick={handleNext}>
                {currentIndex >= slides.length - 1 ? "Ukončit výuku" : "Další slide"}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}
        </div>
        {currentSlide && (
          <TeacherNotesPanel
            key={`${noteTarget.slideId ?? "slide"}-${noteTarget.index}`}
            target={noteTarget}
            initialValue={teacherNotesForSlide(currentSlide)}
            nextTitle={currentIndex + 1 < slides.length ? (slides[currentIndex + 1]?.projector?.headline || `Slide ${currentIndex + 2}`) : undefined}
            collapsed={notesCollapsed}
            onCollapsedChange={changeNotesCollapsed}
            mobileOpen={notesMobileOpen}
            onMobileOpenChange={setNotesMobileOpen}
            onNext={goNextSlide}
            onSave={saveTeacherNotes}
          />
        )}
      </main>
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
          backgroundUrl={sessionBackgroundUrl(settings)}
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
    <Dialog open={teamsDialogOpen} onOpenChange={setTeamsDialogOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upravit týmy</DialogTitle>
        </DialogHeader>
        {session && <TeamSetup session={session as any} players={players as any} />}
      </DialogContent>
    </Dialog>
    </>
  );
};

export default LiveTeacherScreen;

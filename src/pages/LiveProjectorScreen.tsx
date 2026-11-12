import { useParams, useNavigate } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { QRCodeSVG } from "qrcode.react";
import { BookOpen, X, Minus, Plus, Maximize, Minimize, KeyRound } from "lucide-react";
import { useIdleChrome } from "@/hooks/useIdleChrome";
import { useRef } from "react";
import { PROJECTOR_ZOOM_MAX, PROJECTOR_ZOOM_MIN, PROJECTOR_ZOOM_STEP, clampProjectorZoom, loadCodeAlwaysVisible, loadProjectorZoom, saveCodeAlwaysVisible, saveProjectorZoom } from "@/lib/presentation-routes";
import { Button } from "@/components/ui/button";
import WallProjectorView from "@/components/activities/WallProjectorView";
import { AdaptiveReviewProjector } from "@/components/game/AdaptiveReview";
import LiveWhiteboard, { WhiteboardData, getSlideStrokes } from "@/components/game/LiveWhiteboard";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";
import { TeamsSlideProjector } from "@/components/game/TeamsSlide";
import { DifferentiatedSlideProjector } from "@/components/game/DifferentiatedSlide";
import { EscapeGameProjector } from "@/components/game/EscapeGameSlide";
import RaceTrack from "@/components/game/RaceTrack";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { useEffect, useState } from "react";
import { getClockOffset } from "@/lib/clock-sync";
import { isValidZoomRect, isZoomableSlide, type ZoomRect } from "@/lib/zoom-zones";
import { gameBackgroundStyle, sessionBackgroundUrl } from "@/lib/game-backgrounds";
import ProjectorFontScaleControls from "@/components/live/ProjectorFontScaleControls";
import { clampProjectorFontScale, loadProjectorFontScale, saveProjectorFontScale, settingsWithProjectorFontScale } from "@/lib/projector-font-scale";
import { supabase } from "@/integrations/supabase/client";

// Banner spojení je na jednom stabilním místě mimo větve obsahu,
// takže se při změně obrazovky (lobby → snímek → konec) znovu nemontuje.
const LiveProjectorScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const game = useGameSession(sessionId, undefined, undefined, { playersSafetyPollMs: 3000 });
  return (
    <>
      <ConnectionStatusBanner status={game.connectionStatus} onReconnect={game.reconnect} />
      <ProjectorBody sessionId={sessionId} game={game} />
    </>
  );
};

const ProjectorBody = ({ sessionId, game }: { sessionId: string | undefined; game: ReturnType<typeof useGameSession> }) => {
  const navigate = useNavigate();
  const handleClose = () => {
    if (window.opener) window.close();
    else navigate(-1);
  };
  const controlsRef = useRef<HTMLDivElement>(null);
  const chromeVisible = useIdleChrome(true, 3000, controlsRef);
  const session = game.session;
  const settings = (session?.settings as any) || {};
  const [userZoom, setUserZoom] = useState(loadProjectorZoom);
  const [projectorFontScale, setProjectorFontScale] = useState(loadProjectorFontScale);
  const [codeAlwaysVisible, setCodeAlwaysVisible] = useState(loadCodeAlwaysVisible);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const changeZoom = (next: number) => {
    const v = clampProjectorZoom(next);
    setUserZoom(v);
    saveProjectorZoom(v);
  };
  const changeProjectorFontScale = async (nextValue: number) => {
    const next = saveProjectorFontScale(nextValue);
    setProjectorFontScale(next);
    if (!sessionId || !session) return;
    await supabase.from("game_sessions").update({
      settings: settingsWithProjectorFontScale(settings, next) as any,
    }).eq("id", sessionId);
  };
  useEffect(() => {
    if (settings.projectorFontScale == null) return;
    const next = saveProjectorFontScale(settings.projectorFontScale);
    setProjectorFontScale(next);
  }, [settings.projectorFontScale]);
  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "+" || e.key === "=") setUserZoom((z) => { const v = clampProjectorZoom(z + PROJECTOR_ZOOM_STEP); saveProjectorZoom(v); return v; });
      else if (e.key === "-") setUserZoom((z) => { const v = clampProjectorZoom(z - PROJECTOR_ZOOM_STEP); saveProjectorZoom(v); return v; });
      else if (e.key === "0") { setUserZoom(PROJECTOR_ZOOM_MIN); saveProjectorZoom(PROJECTOR_ZOOM_MIN); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* prohlížeč nepovolil */ }
  };
  const chromeClass = `transition-opacity duration-300 motion-reduce:transition-none ${chromeVisible ? "opacity-100" : "pointer-events-none opacity-0"}`;
  const renderCloseButton = (withViewControls = false) => (
    <div
      ref={controlsRef}
      data-testid="projector-controls"
      className={`fixed top-3 right-3 z-50 flex items-center gap-1 rounded-full bg-background/80 p-1 backdrop-blur ${chromeClass}`}
    >
      {withViewControls && (
        <>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Zmenšit" title="Zmenšit (−)" disabled={userZoom <= PROJECTOR_ZOOM_MIN} onClick={() => changeZoom(userZoom - PROJECTOR_ZOOM_STEP)}>
            <Minus className="h-4 w-4" />
          </Button>
          <button type="button" className="min-w-[3.5rem] rounded px-1 text-sm tabular-nums" aria-label="Přizpůsobit obrazovce" title="Přizpůsobit obrazovce (0)" onClick={() => changeZoom(PROJECTOR_ZOOM_MIN)}>
            {userZoom} %
          </button>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Zvětšit" title="Zvětšit (+)" disabled={userZoom >= PROJECTOR_ZOOM_MAX} onClick={() => changeZoom(userZoom + PROJECTOR_ZOOM_STEP)}>
            <Plus className="h-4 w-4" />
          </Button>
          <ProjectorFontScaleControls value={projectorFontScale} onChange={changeProjectorFontScale} className="border-l border-border pl-1" />
          <Button
            variant={codeAlwaysVisible ? "secondary" : "ghost"} size="icon" className="h-9 w-9"
            aria-pressed={codeAlwaysVisible} aria-label="Kód vždy viditelný" title="Kód vždy viditelný"
            onClick={() => { const v = !codeAlwaysVisible; setCodeAlwaysVisible(v); saveCodeAlwaysVisible(v); }}
          >
            <KeyRound className="h-4 w-4" />
          </Button>
        </>
      )}
      <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={isFullscreen ? "Ukončit celou obrazovku" : "Celá obrazovka"} title={isFullscreen ? "Ukončit celou obrazovku" : "Celá obrazovka"} onClick={toggleFullscreen}>
        {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
      </Button>
      <Button onClick={handleClose} variant="ghost" size="sm" className="gap-1.5">
        <X className="w-4 h-4" /> Zavřít
      </Button>
    </div>
  );
  const { players, responses, loading } = game;

  // Tik jen při závodu — jinak se celý projektor (snímek, obrázky) překresloval 2× za sekundu.
  const [now, setNow] = useState(() => Date.now());
  const raceTicking = (session?.settings as any)?.gameMode === "race" && session?.status === "playing";
  useEffect(() => {
    if (!raceTicking) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [raceTicking]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {renderCloseButton()}
        <p className="text-2xl text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        {renderCloseButton()}
        <p className="text-2xl text-muted-foreground">Prezentace nenalezena</p>
      </div>
    );
  }

  const slides = (session.activity_data as any[]) || [];
  const currentIndex = session.current_question_index ?? -1;
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const gameCode = session.game_code || "";
  const joinUrl = `${window.location.origin}/live/pripojit${gameCode ? `?code=${gameCode}` : ""}`;

  const backgroundUrl = sessionBackgroundUrl(settings);
  const isRaceMode = settings.gameMode === "race";
  const raceStartedAtMs = settings.raceStartedAt
    ? new Date(settings.raceStartedAt).getTime()
    : null;
  const raceDurationSec = Number(settings.raceDurationSec) || 180;
  const serverNow = now - getClockOffset();
  const raceRemainingSec = raceStartedAtMs
    ? Math.max(0, Math.round((raceStartedAtMs + raceDurationSec * 1000 - serverNow) / 1000))
    : raceDurationSec;

  // Lobby screen
  if (session.status === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 gap-8 text-white" style={gameBackgroundStyle(backgroundUrl)}>
        {renderCloseButton()}
        <h1 className="text-6xl font-bold text-center">{session.title}</h1>
        <p className="text-2xl text-gray-300">Připojte se k prezentaci</p>
        <div className="bg-white rounded-3xl p-8 mb-10 shadow-2xl">
          <QRCodeSVG value={joinUrl} size={280} />
        </div>
        <div className="text-center">
          <p className="text-xl text-gray-300 mb-2">Kód pro připojení</p>
          <p className="text-8xl font-bold tracking-[0.3em] text-white mt-4">{gameCode}</p>
        </div>
        <p className="text-xl text-gray-300">{players.length} připojených žáků</p>
      </div>
    );
  }

  // Finished screen
  if (session.status === "finished") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-12">
        {renderCloseButton()}
        <div className="text-center space-y-6">
          <p className="text-9xl">🎉</p>
          <h1 className="text-6xl font-bold text-foreground">Prezentace dokončena</h1>
          <p className="text-2xl text-muted-foreground">{session.title}</p>
          <Button onClick={handleClose} size="lg" className="mt-4">Zavřít prezentaci</Button>
        </div>
      </div>
    );
  }

  const adaptive = (session.settings as any)?.adaptive;
  if (adaptive?.showProjector) {
    return (
      <>
        {renderCloseButton()}
        <AdaptiveReviewProjector
          slides={slides}
          responses={responses}
          weakIndices={Array.isArray(adaptive.weakIndices) ? adaptive.weakIndices : undefined}
        />
      </>
    );
  }

  // Race mode: fullscreen Time-to-Climb view instead of the slide projector.
  if (isRaceMode && session.status === "playing") {
    const totalQ = slides.length;
    const finished = players.filter(
      (p) => (p.student_index ?? 0) >= totalQ,
    ).length;
    return (
      <div
        className="min-h-screen flex flex-col p-6 md:p-10 gap-6 text-white"
        style={gameBackgroundStyle(backgroundUrl)}
      >
        {renderCloseButton()}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm md:text-base uppercase tracking-widest text-white/60">
              Závod – Time to Climb
            </p>
            <h1 className="text-3xl md:text-5xl font-bold">{session.title}</h1>
          </div>
          <div className="text-right">
            <p className="text-xs md:text-sm text-white/60 uppercase tracking-widest">
              Hotovo
            </p>
            <p className="text-2xl md:text-4xl font-mono font-bold tabular-nums">
              {finished}/{players.length}
            </p>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <RaceTrack
            session={session}
            players={players}
            mode="progress"
            remainingSec={raceRemainingSec}
            className="h-full"
          />
        </div>
      </div>
    );
  }

  // No slide yet — keep projector gradient background instead of jarring white screen
  if (!currentSlide) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={gameBackgroundStyle(backgroundUrl)}>
        {renderCloseButton()}
      </div>
    );
  }

  const whiteboard: WhiteboardData = ((session as any).whiteboard_data as WhiteboardData) ?? { visible: false, strokesBySlide: {} };

  const scrollTop = (session.settings as any)?.projectorScrollTop ?? 0;
  const rawZoom = (session as any).zoom_state;
  const zoom: ZoomRect | null =
    isZoomableSlide(currentSlide) && isValidZoomRect(rawZoom) ? (rawZoom as ZoomRect) : null;
  const showRaceTrack = !!(session.settings as any)?.showRaceTrack;

  // Standalone "teams" slide — fullscreen team layout
  if ((currentSlide as any)?.activitySpec?.activityType === "teams") {
    return (
      <div className="relative">
        {renderCloseButton()}
        <TeamsSlideProjector session={session} players={players} slide={currentSlide} />
      </div>
    );
  }

  if ((currentSlide as any)?.activitySpec?.activityType === "differentiated") {
    return (
      <div className="relative">
        {renderCloseButton()}
        <DifferentiatedSlideProjector session={session} players={players} slide={currentSlide} />
      </div>
    );
  }

  if ((currentSlide as any)?.activitySpec?.activityType === "escape") {
    return (
      <div className="relative">
        {renderCloseButton()}
        <EscapeGameProjector slide={currentSlide} />
      </div>
    );
  }


  return (
    <div className="relative">
      {renderCloseButton(true)}
      <ProjectorSlideView
        userZoom={userZoom}
        projectorFontScale={projectorFontScale}
        chromeVisible={chromeVisible}
        codeAlwaysVisible={codeAlwaysVisible}
        sessionId={sessionId!}
        session={session}
        currentSlide={currentSlide}
        currentIndex={currentIndex}
        slides={slides}
        players={players}
        gameCode={gameCode}
        scrollTop={scrollTop}
        zoom={zoom}
        backgroundUrl={backgroundUrl}
        responses={responses}
        overlayContent={sessionId && getSlideStrokes(whiteboard, currentIndex).length > 0 ? (
          <LiveWhiteboard sessionId={sessionId} data={whiteboard} slideIndex={currentIndex} readOnly className="pointer-events-none" />
        ) : null}
      />
      {showRaceTrack && players.length > 0 && (
        <div className="fixed left-4 right-4 bottom-4 z-40 pointer-events-none">
          <div className="pointer-events-auto backdrop-blur">
            <RaceTrack session={session} players={players} compact />
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveProjectorScreen;

import { useParams, useNavigate } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { QRCodeSVG } from "qrcode.react";
import { BookOpen, X } from "lucide-react";
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
import { useEffect, useState } from "react";
import { getClockOffset } from "@/lib/clock-sync";
import { isValidZoomRect, isZoomableSlide, type ZoomRect } from "@/lib/zoom-zones";
import { gameBackgroundStyle, sessionBackgroundUrl } from "@/lib/game-backgrounds";

const LiveProjectorScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const handleClose = () => {
    if (window.opener) window.close();
    else navigate(-1);
  };
  const CloseButton = () => (
    <Button
      onClick={handleClose}
      variant="ghost"
      size="sm"
      className="fixed top-4 right-4 z-50 gap-1.5 bg-background/80 hover:bg-background backdrop-blur"
    >
      <X className="w-4 h-4" /> Zavřít
    </Button>
  );
  const { session, players, responses, loading } = useGameSession(sessionId);

  // 1s tick so the race countdown stays live without hammering re-renders.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <CloseButton />
        <p className="text-2xl text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <CloseButton />
        <p className="text-2xl text-muted-foreground">Prezentace nenalezena</p>
      </div>
    );
  }

  const slides = (session.activity_data as any[]) || [];
  const currentIndex = session.current_question_index ?? -1;
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const gameCode = session.game_code || "";
  const joinUrl = `${window.location.origin}/live/pripojit${gameCode ? `?code=${gameCode}` : ""}`;

  const settings = (session.settings as any) || {};
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
        <CloseButton />
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
        <CloseButton />
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
        <CloseButton />
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
        <CloseButton />
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
        <CloseButton />
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
        <CloseButton />
        <TeamsSlideProjector session={session} players={players} slide={currentSlide} />
      </div>
    );
  }

  if ((currentSlide as any)?.activitySpec?.activityType === "differentiated") {
    return (
      <div className="relative">
        <CloseButton />
        <DifferentiatedSlideProjector session={session} players={players} slide={currentSlide} />
      </div>
    );
  }

  if ((currentSlide as any)?.activitySpec?.activityType === "escape") {
    return (
      <div className="relative">
        <CloseButton />
        <EscapeGameProjector slide={currentSlide} />
      </div>
    );
  }


  return (
    <div className="relative">
      <CloseButton />
      <ProjectorSlideView
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

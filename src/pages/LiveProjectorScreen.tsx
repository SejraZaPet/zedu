import { useParams, useNavigate } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { QRCodeSVG } from "qrcode.react";
import { BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import WallProjectorView from "@/components/activities/WallProjectorView";
import { AdaptiveReviewProjector } from "@/components/game/AdaptiveReview";
import LiveWhiteboard, { WhiteboardData } from "@/components/game/LiveWhiteboard";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import ProjectorSlideView from "@/components/live/ProjectorSlideView";

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
  const joinUrl = `${window.location.origin}/live/pripojit`;

  // Lobby screen
  if (session.status === "lobby") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-12 gap-8 text-white" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
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

  // No slide yet — keep projector gradient background instead of jarring white screen
  if (!currentSlide) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
        <CloseButton />
      </div>
    );
  }

  const whiteboard: WhiteboardData = ((session as any).whiteboard_data as WhiteboardData) ?? { strokes: [], visible: false };

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
      />
      {whiteboard.visible && sessionId && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <LiveWhiteboard sessionId={sessionId} data={whiteboard} readOnly />
        </div>
      )}
    </div>
  );
};

export default LiveProjectorScreen;

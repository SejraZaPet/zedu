import { useParams } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { QRCodeSVG } from "qrcode.react";
import { BookOpen } from "lucide-react";
import WallProjectorView from "@/components/activities/WallProjectorView";
import { AdaptiveReviewProjector } from "@/components/game/AdaptiveReview";
import LiveWhiteboard, { WhiteboardData } from "@/components/game/LiveWhiteboard";
import { LessonBlock } from "@/components/LessonBlockRenderer";

const LiveProjectorScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, players, responses, loading } = useGameSession(sessionId);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-2xl text-muted-foreground">Načítání...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
        <div className="text-center space-y-6">
          <p className="text-9xl">🎉</p>
          <h1 className="text-6xl font-bold text-foreground">Prezentace dokončena</h1>
          <p className="text-2xl text-muted-foreground">{session.title}</p>
        </div>
      </div>
    );
  }

  const adaptive = (session.settings as any)?.adaptive;
  if (adaptive?.showProjector) {
    return (
      <AdaptiveReviewProjector
        slides={slides}
        responses={responses}
        weakIndices={Array.isArray(adaptive.weakIndices) ? adaptive.weakIndices : undefined}
      />
    );
  }

  // No slide yet
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-3xl text-muted-foreground">Čekejte na učitele...</p>
      </div>
    );
  }

  const progressPct = slides.length > 0 ? ((currentIndex + 1) / slides.length) * 100 : 0;
  const whiteboard: WhiteboardData = ((session as any).whiteboard_data as WhiteboardData) ?? { strokes: [], visible: false };

  // Slide content
  return (
    <div className="min-h-screen flex flex-col text-white relative" style={{ background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
      {/* Progress bar */}
      <div className="h-2 bg-white/10">
        <div
          className="h-full bg-purple-400 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Slide counter */}
      <div className="flex justify-between items-center px-12 py-6 text-gray-300">
        <span className="text-lg">{session.title}</span>
        <span className="text-lg font-medium">
          Slide {currentIndex + 1} / {slides.length}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 py-8 gap-8">
        {currentSlide.type === "explain" && (
          <div className="mb-2 inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm text-purple-300">
            <BookOpen className="w-4 h-4" />
            Výklad
          </div>
        )}

        {currentSlide.projector?.headline && (
          <h2 className="text-6xl font-bold text-center mb-10 leading-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-purple-200">
            {currentSlide.projector.headline}
          </h2>
        )}

        {!(currentSlide as any).tableData && !(currentSlide as any).cardData && currentSlide.projector?.body && (
          <div className="text-2xl text-gray-300 leading-relaxed space-y-3 w-full max-w-5xl">
            {currentSlide.projector.body.split('\n').filter(Boolean).map((line: string, i: number) => (
              <p key={i} className={line.startsWith('•') ? "flex items-start gap-3" : "text-center"}>
                {line.startsWith('•') ? (
                  <>
                    <span className="text-purple-400 mt-1 flex-shrink-0">•</span>
                    <span>{line.substring(1).trim()}</span>
                  </>
                ) : line}
              </p>
            ))}
          </div>
        )}

        {(currentSlide as any).tableData && (
          <div className="w-full mt-4 rounded-xl overflow-hidden border border-white/20">
            <table className="w-full text-xl border-collapse table-fixed">
              <thead>
                <tr>
                  {(currentSlide as any).tableData.headers.map((h: string, i: number) => (
                    <th
                      key={i}
                      className="border border-white/20 bg-white/20 px-6 py-4 text-left font-bold text-white"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(currentSlide as any).tableData.rows.map((row: string[], ri: number) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white/5" : "bg-white/10"}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="border border-white/20 px-6 py-4 text-white">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {(currentSlide as any).cardData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
            {(currentSlide as any).cardData.map((card: any, i: number) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-8 shadow-sm">
                <h3 className="text-2xl font-bold text-foreground mb-3">{card.title}</h3>
                {card.text && <p className="text-lg text-muted-foreground">{card.text}</p>}
              </div>
            ))}
          </div>
        )}

        {currentSlide.type === "activity" && (currentSlide as any).activitySpec?.activityType === "wall" ? (
          <WallProjectorView
            sessionId={sessionId!}
            questionIndex={currentIndex}
            anonymous={(currentSlide as any).activitySpec?.anonymous || false}
            published={
              (session.settings as any)?.wallPublished === true &&
              (session.settings as any)?.wallPublishedQuestion === currentIndex
            }
          />
        ) : currentSlide.type === "activity" && (
          <div className="mt-8 bg-primary/10 border border-primary/20 rounded-2xl px-8 py-6">
            <div className="flex items-center gap-4 text-primary text-2xl font-medium">
              <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
              Žáci plní aktivitu na svých zařízeních
            </div>
          </div>
        )}
      </div>

      {/* Bottom bar */}
      <div className="px-12 py-6 border-t border-border flex justify-between items-center text-muted-foreground">
        <span className="text-lg">
          Kód: <span className="font-mono font-bold text-foreground">{gameCode}</span>
        </span>
        <span className="text-lg">{players.length} žáků online</span>
      </div>

      {whiteboard.visible && sessionId && (
        <LiveWhiteboard sessionId={sessionId} data={whiteboard} readOnly />
      )}
    </div>
  );
};

export default LiveProjectorScreen;

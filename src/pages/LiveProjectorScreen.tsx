import { useParams } from "react-router-dom";
import { useGameSession } from "@/hooks/useGameSession";
import { QRCodeSVG } from "qrcode.react";
import { BookOpen } from "lucide-react";

const LiveProjectorScreen = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { session, players, loading } = useGameSession(sessionId);

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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-12 gap-8">
        <h1 className="text-6xl font-bold text-foreground text-center">{session.title}</h1>
        <p className="text-2xl text-muted-foreground">Připojte se k prezentaci</p>
        <div className="bg-card p-8 rounded-2xl shadow-lg">
          <QRCodeSVG value={joinUrl} size={280} />
        </div>
        <div className="text-center">
          <p className="text-xl text-muted-foreground mb-2">Kód pro připojení</p>
          <p className="text-8xl font-mono font-bold tracking-widest text-primary">{gameCode}</p>
        </div>
        <p className="text-xl text-muted-foreground">{players.length} připojených žáků</p>
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

  // No slide yet
  if (!currentSlide) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-3xl text-muted-foreground">Čekejte na učitele...</p>
      </div>
    );
  }

  const progressPct = slides.length > 0 ? ((currentIndex + 1) / slides.length) * 100 : 0;

  // Slide content
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Progress bar */}
      <div className="h-2 bg-muted">
        <div
          className="h-full bg-primary transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Slide counter */}
      <div className="flex justify-between items-center px-12 py-6 text-muted-foreground">
        <span className="text-lg">{session.title}</span>
        <span className="text-lg font-medium">
          Slide {currentIndex + 1} / {slides.length}
        </span>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-16 py-8 gap-8">
        {currentSlide.projector?.headline && (
          <h2 className="text-7xl font-bold text-foreground text-center max-w-6xl leading-tight">
            {currentSlide.projector.headline}
          </h2>
        )}

        {!(currentSlide as any).tableData && !(currentSlide as any).cardData && currentSlide.projector?.body && (
          <p className="text-3xl text-muted-foreground text-center max-w-5xl leading-relaxed">
            {currentSlide.projector.body}
          </p>
        )}

        {(currentSlide as any).tableData && (
          <div className="w-full max-w-6xl overflow-auto">
            <table className="w-full border-collapse text-2xl">
              <thead>
                <tr>
                  {(currentSlide as any).tableData.headers.map((h: string, i: number) => (
                    <th
                      key={i}
                      className="border border-border bg-muted px-6 py-4 text-left font-semibold text-foreground"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(currentSlide as any).tableData.rows.map((row: string[], ri: number) => (
                  <tr key={ri}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="border border-border px-6 py-4 text-foreground">
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

        {currentSlide.type === "activity" && (
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
    </div>
  );
};

export default LiveProjectorScreen;

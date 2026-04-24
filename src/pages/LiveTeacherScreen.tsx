import { useParams, useNavigate } from "react-router-dom";
import { useGameSession, useTeacherGameControls } from "@/hooks/useGameSession";
import { ConnectionStatusBanner } from "@/components/game/ConnectionStatusBanner";
import { GameLobby } from "@/components/game/GameLobby";
import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, StickyNote, ChevronLeft, ChevronRight, Users, StopCircle, ArrowLeft } from "lucide-react";
import SessionExports from "@/components/live/SessionExports";
import { supabase } from "@/integrations/supabase/client";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

  const slides: SlideData[] = (session?.activity_data as any[]) || [];
  const currentIndex = session?.current_question_index ?? -1;
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const isLobby = session?.status === "lobby";
  const isFinished = session?.status === "finished";
  const settings = session?.settings as any;
  const gameCode = session?.game_code || "";

  const handleNext = useCallback(() => {
    if (!session) return;
    if (currentIndex >= slides.length - 1) {
      endGame();
    } else {
      nextQuestion(currentIndex);
    }
  }, [session, currentIndex, slides.length, nextQuestion, endGame]);

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

  if (!loading && session && slides.length === 0 && !isFinished && fetchAttempts < 8) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Načítám prezentaci…</div>
      </div>
    );
  }

  if (!loading && session && slides.length === 0 && !isFinished && fetchAttempts >= 8) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4 max-w-sm">
          <p className="text-destructive">Prezentaci se nepodařilo načíst.</p>
          <Button onClick={() => { setFetchAttempts(0); reconnect(); }}>
            Zkusit znovu
          </Button>
        </div>
      </div>
    );
  }

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
    return <GameLobby session={session} players={players} onStart={startGame} isTeacher />;
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
    <div className="min-h-screen bg-background p-6 max-w-4xl mx-auto space-y-6">
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
        <div className="flex gap-2">
          <Badge variant="outline">Slide {currentIndex + 1} / {slides.length}</Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => window.open(`/live/projektor/${sessionId}`, '_blank')}
          >
            <Monitor className="w-4 h-4" />
            Projektor
          </Button>
          <Button size="sm" variant="destructive" onClick={endGame}>
            <StopCircle className="w-4 h-4 mr-1" /> Ukončit
          </Button>
        </div>
      </div>

      {/* Slide strip */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {slides.map((_, i) => (
          <div
            key={i}
            className={`flex-shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-medium ${
              i === currentIndex
                ? "bg-primary text-primary-foreground"
                : i < currentIndex
                ? "bg-muted text-muted-foreground"
                : "bg-muted/50 text-muted-foreground/50"
            }`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {currentSlide && (
        <div className="space-y-4">
          <Badge>{SLIDE_TYPE_LABELS[currentSlide.type] || currentSlide.type}</Badge>

          {/* Projector */}
          <div className="border border-border rounded-lg p-6 bg-background">
            <div className="flex items-center gap-2 mb-3 text-xs font-medium text-muted-foreground">
              <Monitor className="w-4 h-4" /> PROJEKTOR
            </div>
            <h2 className="text-2xl font-bold">{currentSlide.projector.headline}</h2>
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
          </div>

          {currentSlide.type === "activity" && (
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

          {/* Teacher notes */}
          {currentSlide.teacherNotes && (
            <div className="border border-dashed border-border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1 text-xs font-medium text-muted-foreground">
                <StickyNote className="w-3.5 h-3.5" /> POZNÁMKY
              </div>
              <p className="text-xs text-muted-foreground">{currentSlide.teacherNotes}</p>
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
            <Button onClick={handleNext}>
              {currentIndex >= slides.length - 1 ? "Ukončit výuku" : "Další slide"}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default LiveTeacherScreen;

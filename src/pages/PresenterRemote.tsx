import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Pause, Play, StopCircle, Menu, Clock,
} from "lucide-react";
import {
  Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";

type Cmd = "next" | "prev" | "pause" | "resume" | "end" | "goto";

interface SessionInfo {
  id: string;
  title: string;
  teacher_id: string;
  status: string;
  current_question_index: number;
  activity_data: any;
  created_at: string;
}

const channelName = (sid: string) => `presenter-remote-${sid}`;

export default function PresenterRemote() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [paused, setPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const touchStartX = useRef<number | null>(null);

  // Load session and authorize
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) {
        if (!cancelled) setAuthorized(false);
        return;
      }
      const { data, error } = await supabase
        .from("game_sessions")
        .select("id,title,teacher_id,status,current_question_index,activity_data,created_at")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) { setAuthorized(false); return; }
      setSession(data as SessionInfo);
      setAuthorized(data.teacher_id === uid);
    })();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Realtime: listen for session updates and join broadcast channel
  useEffect(() => {
    if (!sessionId || !authorized) return;
    const ch = supabase.channel(channelName(sessionId), {
      config: { broadcast: { self: false, ack: true } },
    });
    ch.on("postgres_changes", {
      event: "UPDATE", schema: "public", table: "game_sessions", filter: `id=eq.${sessionId}`,
    }, (payload) => {
      setSession((s) => s ? { ...s, ...(payload.new as any) } : (payload.new as any));
    });
    ch.subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); channelRef.current = null; };
  }, [sessionId, authorized]);

  // Timer
  useEffect(() => {
    if (!session) return;
    const start = new Date(session.created_at).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  const slides = useMemo(() => (session?.activity_data as any[]) || [], [session]);
  const currentIndex = session?.current_question_index ?? -1;
  const currentSlide = currentIndex >= 0 ? slides[currentIndex] : null;
  const isFinished = session?.status === "finished";

  const send = async (cmd: Cmd, payload?: Record<string, any>) => {
    if (!channelRef.current) return;
    if (cmd === "pause") setPaused(true);
    if (cmd === "resume") setPaused(false);
    await channelRef.current.send({
      type: "broadcast",
      event: "remote-cmd",
      payload: { cmd, ...payload },
    });
  };

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    if (dx < 0) send("next");
    else send("prev");
  };

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
      : `${m}:${String(sec).padStart(2, "0")}`;
  };

  if (authorized === null) {
    return <div className="min-h-[100dvh] flex items-center justify-center text-muted-foreground">Načítám…</div>;
  }
  if (authorized === false) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-destructive font-medium">Nemáte oprávnění ovládat tuto prezentaci.</p>
        <Button onClick={() => navigate("/auth")}>Přihlásit se</Button>
      </div>
    );
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-background select-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="Menu">
              <Menu className="w-6 h-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80">
            <SheetHeader>
              <SheetTitle>{session?.title || "Prezentace"}</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" /> Běží {fmtTime(elapsed)}
              </div>
              <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-2">
                <p className="text-xs text-muted-foreground mb-2">Slidy ({slides.length})</p>
                {slides.map((s: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => { send("goto", { index: i }); setMenuOpen(false); }}
                    className={`w-full text-left text-sm px-3 py-2 rounded border ${
                      i === currentIndex
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    <span className="font-mono mr-2">{i + 1}.</span>
                    <span className="truncate">{s?.projector?.headline || `Slide ${i + 1}`}</span>
                  </button>
                ))}
              </div>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => { send("end"); setMenuOpen(false); }}
              >
                <StopCircle className="w-4 h-4 mr-2" /> Ukončit prezentaci
              </Button>
            </div>
          </SheetContent>
        </Sheet>
        <div className="text-center">
          <div className="text-xs text-muted-foreground">Slide</div>
          <div className="font-bold text-lg leading-none">
            {currentIndex < 0 ? "—" : currentIndex + 1} / {slides.length}
          </div>
        </div>
        <div className="flex items-center gap-1 text-sm tabular-nums">
          <Clock className="w-4 h-4" /> {fmtTime(elapsed)}
        </div>
      </header>

      {/* Top half: slide preview */}
      <section className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        <div className="w-full max-w-md aspect-video bg-card border border-border rounded-xl shadow-sm flex flex-col p-5 overflow-hidden">
          {isFinished ? (
            <div className="m-auto text-center text-muted-foreground">Prezentace ukončena</div>
          ) : currentSlide ? (
            <>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                {currentSlide.type || "Slide"}
              </div>
              <h2 className="text-xl font-bold leading-tight line-clamp-3">
                {currentSlide.projector?.headline || "—"}
              </h2>
              {currentSlide.projector?.body && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-5 whitespace-pre-wrap">
                  {currentSlide.projector.body}
                </p>
              )}
            </>
          ) : (
            <div className="m-auto text-center text-muted-foreground">Čekání na začátek…</div>
          )}
        </div>
      </section>

      {/* Bottom half: controls */}
      <section className="border-t border-border p-4 grid grid-cols-3 gap-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <Button
          size="lg"
          variant="outline"
          className="h-20 text-base"
          onClick={() => send("prev")}
          disabled={isFinished || currentIndex <= 0}
          aria-label="Předchozí slide"
        >
          <ChevronLeft className="w-7 h-7" />
        </Button>
        <Button
          size="lg"
          variant={paused ? "default" : "secondary"}
          className="h-20 text-base"
          onClick={() => send(paused ? "resume" : "pause")}
          disabled={isFinished}
          aria-label={paused ? "Pokračovat" : "Pauza"}
        >
          {paused ? <Play className="w-7 h-7" /> : <Pause className="w-7 h-7" />}
        </Button>
        <Button
          size="lg"
          className="h-20 text-base"
          onClick={() => send("next")}
          disabled={isFinished}
          aria-label="Další slide"
        >
          <ChevronRight className="w-7 h-7" />
        </Button>
        <Button
          size="lg"
          variant="destructive"
          className="col-span-3 h-14"
          onClick={() => send("end")}
          disabled={isFinished}
        >
          <StopCircle className="w-5 h-5 mr-2" /> Ukončit prezentaci
        </Button>
        <p className="col-span-3 text-center text-xs text-muted-foreground">
          Tip: přejeďte prstem doleva / doprava pro navigaci.
        </p>
      </section>
    </div>
  );
}

export { channelName as presenterRemoteChannelName };

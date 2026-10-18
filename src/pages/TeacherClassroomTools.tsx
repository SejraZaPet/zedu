import { useEffect, useRef, useState } from "react";
import { Dices, Maximize, Mic, Minimize, Monitor, Timer, Type, Users, Watch, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { CountdownTool, StopwatchTool } from "@/components/classroom/ClockTools";
import { PeopleTool } from "@/components/classroom/PeopleTools";
import { MegatextTool } from "@/components/classroom/MegatextTool";
import { VolumeTool } from "@/components/classroom/VolumeTool";
import "@/styles/classroom-tools.css";

const tools = [
  { id: "countdown", name: "Odpočet", icon: Timer },
  { id: "stopwatch", name: "Stopky", icon: Watch },
  { id: "draw", name: "Losování", icon: Dices },
  { id: "groups", name: "Skupiny", icon: Users },
  { id: "text", name: "Megatext", icon: Type },
  { id: "volume", name: "Měřič hlasitosti", icon: Mic },
];
export default function TeacherClassroomTools() {
  const [active, setActive] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const hadFullscreen = useRef(false);
  useEffect(() => {
    const changed = () => {
      const isFull = Boolean(document.fullscreenElement);
      setFull(isFull);
      if (hadFullscreen.current && !isFull) setActive(null);
      hadFullscreen.current = isFull;
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const close = () => { setActive(null); if (document.fullscreenElement) void document.exitFullscreen().catch(() => {}); };
  const fullscreen = async () => {
    setError("");
    try {
      if (document.fullscreenElement) { hadFullscreen.current = false; await document.exitFullscreen(); }
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else setError("Tento prohlížeč nepodporuje celou obrazovku. Nástroj můžete používat v tomto velkém zobrazení.");
    } catch { setError("Celou obrazovku se nepodařilo zapnout. Zkuste tlačítko znovu."); }
  };
  const tool = tools.find(t => t.id === active);
  return <div className="min-h-screen flex flex-col bg-background">
    <SiteHeader />
    <main className="container mx-auto max-w-5xl flex-1 px-4 pb-16 pt-32">
      <div className="mb-8 flex items-center gap-4"><Monitor className="h-10 w-10 text-primary" /><h1 className="text-3xl font-heading">Nástroje do hodiny</h1></div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{tools.map(t => <Button key={t.id} variant="outline" className="h-48 flex-col gap-5 rounded-lg border-border bg-card text-xl whitespace-normal" onClick={() => { setError(""); setActive(t.id); }}><t.icon className="!h-12 !w-12 text-primary" />{t.name}</Button>)}</div>
    </main>
    <SiteFooter />
    <Dialog open={Boolean(active)} onOpenChange={open => { if (!open) close(); }}>
      <DialogPortal><DialogOverlay /><DialogPrimitive.Content ref={stage} aria-describedby={undefined} className="classroom-stage fixed inset-0 z-[100] bg-background text-foreground" onEscapeKeyDown={close}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <DialogTitle className="text-xl font-heading">{tool?.name}</DialogTitle>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void fullscreen()}>{full ? <Minimize /> : <Maximize />}{full ? "Zmenšit" : "Celá obrazovka"}</Button><DialogClose asChild><Button variant="ghost" size="icon" title="Zavřít" aria-label="Zavřít"><X /></Button></DialogClose></div>
        </header>
        {error && <p role="status">{error}</p>}
        {active === "countdown" && <CountdownTool />}
        {active === "stopwatch" && <StopwatchTool />}
        {active === "draw" && <PeopleTool />}
        {active === "groups" && <PeopleTool grouping />}
        {active === "text" && <MegatextTool />}
        {active === "volume" && <VolumeTool />}
      </DialogPrimitive.Content></DialogPortal>
    </Dialog>
  </div>;
}

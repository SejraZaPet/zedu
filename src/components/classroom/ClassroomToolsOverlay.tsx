import { useEffect, useRef, useState } from "react";
import { Dices, Maximize, Mic, Minimize, Timer, Type, Users, Watch, X } from "lucide-react";
import { Dialog, DialogClose, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { CountdownTool, StopwatchTool } from "@/components/classroom/ClockTools";
import { PeopleTool } from "@/components/classroom/PeopleTools";
import { MegatextTool } from "@/components/classroom/MegatextTool";
import { VolumeTool } from "@/components/classroom/VolumeTool";
import "@/styles/classroom-tools.css";

export const classroomTools = [
  { id: "countdown", name: "Odpočet", icon: Timer },
  { id: "stopwatch", name: "Stopky", icon: Watch },
  { id: "draw", name: "Losování", icon: Dices },
  { id: "groups", name: "Skupiny", icon: Users },
  { id: "text", name: "Megatext", icon: Type },
  { id: "volume", name: "Hlasitost", icon: Mic },
];

import type { ClassroomTarget } from "@/lib/classroom-tools";
export interface ClassroomToolRequest { id: string; duration?: number; autoStart?: boolean }
export function ClassroomToolsOverlay({ request, onClose, target }: { request: ClassroomToolRequest | null; onClose: () => void; target?: ClassroomTarget }) {
  const [full, setFull] = useState(false);
  const [error, setError] = useState("");
  const stage = useRef<HTMLDivElement>(null);
  const hadFullscreen = useRef(false);
  const latestClose = useRef(onClose);
  latestClose.current = onClose;
  const closing = useRef(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement>();
  useEffect(() => {
    if (!request) return;
    closing.current = false;
    setError("");
    // A portal must stay inside the teacher's fullscreen element to remain visible.
    setPortalContainer(document.fullscreenElement instanceof HTMLElement ? document.fullscreenElement : undefined);
  }, [request]);
  useEffect(() => {
    const changed = () => {
      const isFull = Boolean(stage.current && document.fullscreenElement === stage.current);
      setFull(isFull);
      if (hadFullscreen.current && !isFull && !closing.current) {
        closing.current = true;
        latestClose.current();
      }
      hadFullscreen.current = isFull;
    };
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const close = () => {
    if (closing.current) return;
    closing.current = true;
    const ownsFullscreen = stage.current && document.fullscreenElement === stage.current;
    hadFullscreen.current = false;
    latestClose.current();
    if (ownsFullscreen) void document.exitFullscreen().catch(() => {});
  };
  const fullscreen = async () => {
    setError("");
    try {
      if (stage.current && document.fullscreenElement === stage.current) { hadFullscreen.current = false; await document.exitFullscreen(); }
      else if (stage.current?.requestFullscreen) await stage.current.requestFullscreen();
      else setError("Tento prohlížeč nepodporuje celou obrazovku. Nástroj můžete používat v tomto velkém zobrazení.");
    } catch { setError("Celou obrazovku se nepodařilo zapnout. Zkuste tlačítko znovu."); }
  };
  const tool = classroomTools.find(t => t.id === request?.id);
  return (
    <Dialog open={Boolean(request)} onOpenChange={open => { if (!open) close(); }}>
      <DialogPortal container={portalContainer}><DialogOverlay /><DialogPrimitive.Content ref={stage} aria-describedby={undefined} className="classroom-stage fixed inset-0 z-[100] bg-background text-foreground" onEscapeKeyDown={event => { event.preventDefault(); close(); }}>
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
          <DialogTitle className="text-xl font-heading">{tool?.name}</DialogTitle>
          <div className="flex gap-2"><Button variant="outline" onClick={() => void fullscreen()}>{full ? <Minimize /> : <Maximize />}{full ? "Zmenšit" : "Celá obrazovka"}</Button><DialogClose asChild><Button variant="ghost" size="icon" title="Zavřít" aria-label="Zavřít"><X /></Button></DialogClose></div>
        </header>
        {error && <p role="status">{error}</p>}
        {request?.id === "countdown" && <CountdownTool key={`${request.duration}-${request.autoStart}`} initialDuration={request?.duration} autoStart={request?.autoStart} />}
        {request?.id === "stopwatch" && <StopwatchTool />}
        {request?.id === "draw" && <PeopleTool initialTarget={target} />}
        {request?.id === "groups" && <PeopleTool grouping initialTarget={target} />}
        {request?.id === "text" && <MegatextTool />}
        {request?.id === "volume" && <VolumeTool />}
      </DialogPrimitive.Content></DialogPortal>
    </Dialog>
  );
}

export function ClassroomToolsBar({ onOpen }: { onOpen: (request: ClassroomToolRequest) => void }) {
  return <div role="toolbar" aria-label="Nástroje" className="mb-6 flex flex-wrap items-center gap-2 border-y border-border py-3"><span className="mr-2 font-semibold">Nástroje</span>{classroomTools.map(t => <Button key={t.id} type="button" variant="outline" className="min-h-12" onClick={() => onOpen({ id: t.id })}><t.icon />{t.name}</Button>)}</div>;
}

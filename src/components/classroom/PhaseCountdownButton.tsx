import { Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { phaseCountdownDuration } from "@/lib/classroom-tools";
import type { ClassroomToolRequest } from "./ClassroomToolsOverlay";

export function PhaseCountdownButton({ timeMin, onOpen }: { timeMin: unknown; onOpen: (request: ClassroomToolRequest) => void }) {
  const duration = phaseCountdownDuration(timeMin);
  return <Button type="button" variant="outline" className="min-h-12" disabled={duration === null} onClick={() => {
    if (duration === null) return;
    onOpen({ id: "countdown", duration, autoStart: true });
  }}><Timer />Spustit odpočet</Button>;
}
import { useEffect } from "react";
import { Play, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { awaitingActivityTitle } from "@/components/live/AwaitingStartNotice";

const isTypingTarget = (t: EventTarget | null) => {
  const el = t as HTMLElement | null;
  if (!el) return false;
  return !!el.closest?.("input, textarea, select, button, a, [contenteditable='true'], [role='dialog'], [role='menu']");
};

/** Výrazný panel „Spustit aktivitu“ přišpendlený u spodního okraje, vždy viditelný. Enter/mezerník spustí. */
const StartActivityPanel = ({ slide, playerCount, onStart }: { slide: any; playerCount?: number; onStart: () => void }) => {
  const title = awaitingActivityTitle(slide);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onStart]);
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 p-3 pointer-events-none" data-testid="start-activity-panel">
      <div role="status" aria-live="polite" className="pointer-events-auto mx-auto max-w-3xl rounded-xl border-2 border-primary bg-card shadow-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button onClick={onStart} size="lg" className="min-h-[56px] text-base sm:text-lg gap-2 flex-1 whitespace-normal h-auto py-3" data-testid="start-activity">
          <Play className="w-5 h-5 shrink-0" aria-hidden />
          <span className="break-words">Spustit aktivitu{title ? `: ${title}` : ""}</span>
        </Button>
        <div className="text-sm text-center sm:text-left">
          <p className="font-medium flex items-center justify-center sm:justify-start gap-1.5">
            <Users className="w-4 h-4" aria-hidden /> Žáci čekají{typeof playerCount === "number" ? ` (${playerCount})` : ""}
          </p>
          <p className="text-xs text-muted-foreground">Enter nebo mezerník</p>
        </div>
      </div>
    </div>
  );
};

export default StartActivityPanel;

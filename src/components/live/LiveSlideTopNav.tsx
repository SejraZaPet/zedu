import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/** Kláves/cíl, který nemá posouvat slidy (psaní do polí, editory). */
export function isTypingTarget(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

/** Klávesa → směr posunu slidu (šipky, PageUp/PageDown). */
export function slideKeyDirection(key: string): -1 | 1 | 0 {
  if (key === "ArrowRight" || key === "PageDown") return 1;
  if (key === "ArrowLeft" || key === "PageUp") return -1;
  return 0;
}

/** Stále dostupná navigace v jediné horní liště promítání. */
export default function LiveSlideTopNav({
  index,
  total,
  onPrev,
  onNext,
  typeLabel,
}: {
  index: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  typeLabel?: string;
}) {
  const atStart = index <= 0;
  const atEnd = index >= total - 1;
  return (
    <div role="toolbar" aria-label="Ovládání promítání" className="flex shrink-0 items-center gap-1 font-deck-body">
      <Button size="icon" variant="ghost" className="h-11 w-11 lg:h-9 lg:w-9" disabled={atStart} onClick={onPrev} aria-label="Předchozí slide" title="Předchozí slide">
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <div className="flex min-w-[4.25rem] flex-col items-center justify-center leading-none">
        <span className="px-1 text-center font-deck-heading text-sm tabular-nums text-deck-violet-deep" aria-live="polite">
          {Math.max(1, index + 1)} / {total}
        </span>
        {typeLabel && <Badge variant="outline" className="mt-1 hidden px-1.5 py-0 text-[9px] font-normal md:inline-flex">{typeLabel}</Badge>}
      </div>
      <Button size="icon" variant="ghost" className="h-11 w-11 lg:h-9 lg:w-9" disabled={atEnd} onClick={onNext} aria-label="Další slide" title="Další slide">
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}

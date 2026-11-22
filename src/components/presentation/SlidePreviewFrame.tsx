import { useEffect, useRef, useState } from "react";
import { SlideBody, STAGE_H, STAGE_W } from "@/components/admin/SlideCanvas";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";

/** Živý 16:9 náhled nad stejným vykreslovačem jako editor, projekce a PDF. */
export default function SlidePreviewFrame({ slide, themeId = "minimal", label }: { slide: any; themeId?: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(1, entry.contentRect.width)));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className="relative aspect-video w-full overflow-hidden rounded-xl border border-deck-line shadow-sm" style={themeStageStyle(getPresentationTheme(themeId))} aria-label={label ?? "Náhled slidu"}>
      <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${width / STAGE_W})` }}>
        <SlideBody slide={slide} themeId={themeId} />
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import WallProjectorView from "@/components/activities/WallProjectorView";
import WordCloudView from "@/components/activities/WordCloudView";
import ActivityTaskPreview, { hasActivityTaskPreview } from "@/components/live/ActivityTaskPreview";

import SlideCanvas from "@/components/admin/SlideCanvas";
import { slideTransitionClass } from "@/lib/slide-transitions";
import { slideWithFallbackBlocks, slideImageUrls } from "@/lib/slide-canvas-fallback";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";
import { slideBackgroundOverrideStyle } from "@/lib/slide-typography";
import { buildAnonymousLabelMap, type GamePlayer } from "@/lib/game-types";
import { zoomStageStyle, type ZoomRect } from "@/lib/zoom-zones";
import { gameBackgroundStyle } from "@/lib/game-backgrounds";

const STAGE_WIDTH = 1600;
const STAGE_HEIGHT = 900;

interface Props {
  sessionId: string;
  session: any;
  currentSlide: any;
  currentIndex: number;
  slides: any[];
  players: any[];
  gameCode: string;
  overlayContent?: ReactNode;
  scrollTop?: number;
  /** Active zoom crop in % of the stage, or null for the full slide. */
  zoom?: ZoomRect | null;
  /** Volitelné herní pozadí (obrázek pod obsahem slidu). */
  backgroundUrl?: string | null;
}

/**
 * Shared full-viewport projector slide layout.
 * Used by both LiveProjectorScreen and LiveTeacherScreen (under whiteboard overlay)
 * so that whiteboard strokes align identically in both views.
 */
const ProjectorSlideView = ({ sessionId, session, currentSlide, currentIndex, slides, players, gameCode, overlayContent, zoom, backgroundUrl }: Props) => {
  const progressPct = slides.length > 0 ? ((currentIndex + 1) / slides.length) * 100 : 0;
  const anonymousAnswers = !!(session?.settings as any)?.anonymousAnswers;
  const anonymousLabelMap = useMemo(
    () => (anonymousAnswers ? buildAnonymousLabelMap(players as GamePlayer[]) : undefined),
    [anonymousAnswers, players]
  );
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const width = frame.clientWidth;
      const height = frame.clientHeight;
      if (!width || !height) return;
      setScale(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(frame);
    window.addEventListener("resize", updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, []);

  // Přednačtení obrázků následujícího snímku, ať těžší slide nenabíhá s prodlevou.
  useEffect(() => {
    const next = slides[currentIndex + 1];
    if (!next) return;
    const urls = slideImageUrls(next);
    const imgs = urls.map((url) => {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      return img;
    });
    return () => {
      imgs.forEach((img) => {
        img.src = "";
      });
    };
  }, [currentIndex, slides]);

  const projectorTheme = getPresentationTheme((currentSlide as any)?.themeId);
  const projectorBgOverride = slideBackgroundOverrideStyle(currentSlide);
  const projectorStageStyle: CSSProperties = projectorBgOverride
    ? { ...(({ background, ...rest }) => rest)(themeStageStyle(projectorTheme) as any), ...projectorBgOverride }
    : backgroundUrl
      ? gameBackgroundStyle(backgroundUrl)
      : themeStageStyle(projectorTheme);

  // Snímky bez bloků dostanou dopočítané bloky, aby měly stejnou sazbu
  // i „scale-to-fit“ chování jako blokové snímky.
  const canvasSlide = useMemo(() => slideWithFallbackBlocks(currentSlide), [currentSlide]);
  const hasCanvasContent = !!(
    canvasSlide &&
    ((canvasSlide.blocks && canvasSlide.blocks.length > 0) || canvasSlide.projector?.headline)
  );

  const activityType = currentSlide?.type === "activity" ? currentSlide?.activitySpec?.activityType : null;

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${projectorTheme.isDark ? "" : "text-foreground"}`}
      style={projectorStageStyle}
    >
      <div ref={frameRef} className="absolute inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/2 origin-center text-white"
          style={{
            width: `${STAGE_WIDTH}px`,
            height: `${STAGE_HEIGHT}px`,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          <div className="relative h-full w-full overflow-hidden">
            {/* Přechod animuje CELOU scénu (lišta, hlavička, obsah i patička),
                takže se při výměně snímku nic neblikne. */}
            <div
              key={currentIndex}
              className={`flex h-full flex-col overflow-hidden relative ${
                slideTransitionClass((currentSlide as any)?.transitionStyle) || "slide-trans-fade"
              }`}
              style={zoomStageStyle(zoom)}
            >
              <div className="h-2 bg-white/10 shrink-0">
                <div className="h-full bg-purple-400 transition-all duration-500" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="flex justify-between items-center px-12 py-6 text-gray-300 shrink-0">
                <span className="text-lg">{session.title}</span>
                <span className="text-lg font-medium">Snímek {currentIndex + 1} / {slides.length}</span>
              </div>

              <div className="flex-1 flex flex-col items-center justify-start px-6 py-4 gap-4 min-h-0 overflow-hidden">
                {currentSlide.type === "explain" && (
                  <div className="mb-2 inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-1.5 text-sm text-purple-300 shrink-0">
                    <BookOpen className="w-4 h-4" /> Výklad
                  </div>
                )}

                {hasCanvasContent && (
                  /* Přesně stejný renderer jako editor: celá scéna 1600×900 se
                     proporčně zmenší do dostupného místa, takže se prvky
                     nepřekrývají a rozvržení odpovídá editoru. */
                  <div className="w-full flex-1 min-h-0 flex items-center justify-center">
                    <SlideCanvas
                      key={currentIndex}
                      slide={canvasSlide}
                      themeId={(currentSlide as any)?.themeId}
                      darkMode
                      revealStep={(session?.settings as any)?.revealStep}
                    />
                  </div>
                )}

                {activityType === "wall" ? (
                  <WallProjectorView
                    sessionId={sessionId}
                    questionIndex={currentIndex}
                    anonymous={currentSlide.activitySpec?.anonymous || false}
                    anonymousLabelMap={anonymousLabelMap}
                    published={
                      (session.settings as any)?.wallPublished === true &&
                      (session.settings as any)?.wallPublishedQuestion === currentIndex
                    }
                  />
                ) : activityType === "wordcloud" ? (
                  <WordCloudView
                    sessionId={sessionId}
                    questionIndex={currentIndex}
                    published={
                      (session.settings as any)?.wordcloudPublished === true &&
                      (session.settings as any)?.wordcloudPublishedQuestion === currentIndex
                    }
                    darkMode
                  />
                ) : currentSlide.type === "activity" && hasActivityTaskPreview(currentSlide.activitySpec) ? (
                  <div className="w-full max-w-5xl rounded-2xl border border-white/20 bg-white/5 px-8 py-6 shrink-0 text-xl">
                    <ActivityTaskPreview spec={currentSlide.activitySpec} darkMode />
                  </div>
                ) : currentSlide.type === "activity" ? (
                  <div className="bg-primary/10 border border-primary/20 rounded-2xl px-8 py-6 shrink-0">
                    <div className="flex items-center gap-4 text-primary text-2xl font-medium">
                      <span className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                      Žáci plní aktivitu na svých zařízeních
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="px-12 py-6 border-t border-border flex justify-between items-center text-muted-foreground shrink-0">
                <span className="text-lg">Kód: <span className="font-mono font-bold text-foreground">{gameCode}</span></span>
                <span className="text-lg">{players.length} žáků online</span>
              </div>

              {overlayContent}
            </div>

            {/* Nenápadný ukazatel postupu – viditelný žákům po celou dobu. */}
            <div className="pointer-events-none absolute bottom-3 right-4 rounded-full bg-black/30 px-3 py-1 text-sm font-medium text-white/70 backdrop-blur-sm">
              Snímek {currentIndex + 1}/{slides.length}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectorSlideView;

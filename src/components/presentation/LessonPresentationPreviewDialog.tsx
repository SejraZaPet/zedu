import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { slideWithFallbackBlocks } from "@/lib/slide-canvas-fallback";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";
import type { Block } from "@/lib/textbook-config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: Block[];
  lessonTitle?: string;
  heroImageUrl?: string | null;
}

/**
 * Rychlý náhled prezentace přímo nad editorem lekce.
 * Snímky se generují stejnou funkcí jako „Spustit prezentaci“ (`blocksToSlides`),
 * ale nevzniká žádná relace pro žáky ani se nic neukládá.
 */
const LessonPresentationPreviewDialog = ({ open, onOpenChange, blocks, lessonTitle, heroImageUrl }: Props) => {
  const [index, setIndex] = useState(0);

  const slides = useMemo(() => {
    if (!open) return [];
    try {
      return blocksToSlides(blocks || [], lessonTitle || "Lekce", { heroImageUrl: heroImageUrl || undefined });
    } catch {
      return [];
    }
  }, [open, blocks, lessonTitle, heroImageUrl]);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        setIndex((i) => Math.min(i + 1, Math.max(slides.length - 1, 0)));
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        setIndex((i) => Math.max(i - 1, 0));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slides.length]);

  const current = slides[index];
  const canvasSlide = useMemo(() => (current ? slideWithFallbackBlocks(current) : null), [current]);
  const theme = getPresentationTheme((current as any)?.themeId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] max-h-[92vh] overflow-hidden p-0">
        <DialogHeader className="px-6 py-3 border-b border-border">
          <DialogTitle className="text-sm font-medium">
            Náhled prezentace{slides.length > 0 ? ` – snímek ${index + 1} / ${slides.length}` : ""}
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 space-y-3">
          {slides.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">
              Z obsahu lekce se zatím nedá vytvořit žádný snímek.
            </p>
          ) : (
            <>
              <div
                className="relative w-full aspect-video rounded-lg overflow-hidden text-white"
                style={themeStageStyle(theme)}
              >
                {canvasSlide && (
                  <SlideCanvas key={index} slide={canvasSlide} themeId={(current as any)?.themeId} darkMode />
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                  disabled={index === 0}
                  aria-label="Předchozí snímek"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground">
                  {index + 1} / {slides.length}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIndex((i) => Math.min(i + 1, slides.length - 1))}
                  disabled={index >= slides.length - 1}
                  aria-label="Další snímek"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1">
                {slides.map((s: any, i: number) => (
                  <button
                    key={s.slideKey || s.id || i}
                    type="button"
                    onClick={() => setIndex(i)}
                    className={`shrink-0 rounded border px-3 py-2 text-xs text-left w-40 truncate ${
                      i === index ? "border-primary bg-primary/10" : "border-border bg-card"
                    }`}
                    title={s?.projector?.headline || s?.title || `Snímek ${i + 1}`}
                  >
                    {i + 1}. {s?.projector?.headline || s?.title || "Snímek"}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LessonPresentationPreviewDialog;

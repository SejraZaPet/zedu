import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import SlideCanvas from "@/components/admin/SlideCanvas";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { slideWithFallbackBlocks } from "@/lib/slide-canvas-fallback";
import type { Block } from "@/lib/textbook-config";
import { STAGE_H, STAGE_W } from "@/lib/slide-stage";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

/** Světlé téma pro uloženou kopii – odpovídá světlému náhledu z lekce. */
const LIGHT_COPY_THEME_ID = "minimal";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  blocks: Block[];
  lessonTitle?: string;
  heroImageUrl?: string | null;
}

/**
 * Stejný model vykreslení jako v projektoru: nativní scéna 1600 × 900 se
 * jednou proporčně zmenší do dostupného rámu. `SlideCanvas` zde nesmí měřit
 * současně sebe i rodiče — v dialogu tím vznikla nulová/nesprávná transformace.
 */
const PreviewSlideStage = ({ slide }: { slide: any }) => {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const update = () => {
      if (!frame.clientWidth || !frame.clientHeight) return;
      setScale(Math.min(frame.clientWidth / STAGE_W, frame.clientHeight / STAGE_H));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frameRef} className="relative h-full min-h-0 w-full overflow-hidden rounded-lg bg-background">
      <div
        className="absolute left-1/2 top-1/2 origin-center"
        style={{
          width: `${STAGE_W}px`,
          height: `${STAGE_H}px`,
          transform: `translate(-50%, -50%) scale(${scale})`,
        }}
      >
        <SlideCanvas
          fit={false}
          slide={slide}
          themeId={slide?.themeId}
          darkMode={slide?.presentationSource !== "lesson"}
        />
      </div>
    </div>
  );
};

/**
 * Rychlý náhled prezentace přímo nad editorem lekce.
 * Snímky se generují stejnou funkcí jako „Spustit prezentaci“ (`blocksToSlides`),
 * ale nevzniká žádná relace pro žáky ani se nic neukládá.
 */
const LessonPresentationPreviewDialog = ({ open, onOpenChange, blocks, lessonTitle, heroImageUrl }: Props) => {
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

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

  /**
   * Uloží aktuálně vygenerované snímky jako samostatnou (dál upravitelnou)
   * prezentaci. Odstraníme příznak `presentationSource: "lesson"`, aby se kopie
   * chovala jako běžná standalone prezentace a nepřegenerovávala se z lekce.
   */
  const saveAsEditableCopy = async () => {
    if (!slides.length || saving) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nejste přihlášeni.");

      const baseTitle = `${lessonTitle || "Prezentace"} – kopie`;
      const { data: existing } = await supabase
        .from("teacher_presentations" as any)
        .select("title")
        .eq("teacher_id", user.id)
        .like("title", `${baseTitle}%`);
      const taken = new Set(((existing ?? []) as any[]).map((r) => r.title));
      let title = baseTitle;
      let n = 2;
      while (taken.has(title)) title = `${baseTitle} ${n++}`;

      // Bez `presentationSource` by se kopie vrátila k výchozímu TMAVÉMU tématu.
      // Proto rovnou zapíšeme explicitní světlé téma, aby kopie vypadala stejně
      // jako náhled (světlé pozadí, barvy bloků z lekce).
      const copiedSlides = slides.map((s: any, i: number) => {
        const { presentationSource: _src, ...rest } = s || {};
        return {
          ...rest,
          themeId: LIGHT_COPY_THEME_ID,
          slideId: rest.slideId || `slide-${Date.now()}-${i}`,
        };
      });

      const { data, error } = await supabase
        .from("teacher_presentations" as any)
        .insert({ teacher_id: user.id, title, slides: copiedSlides })
        .select("id")
        .single();
      if (error) throw error;

      toast({ title: "Kopie uložena", description: `Prezentace „${title}“ je připravená k úpravám.` });
      onOpenChange(false);
      navigate(`/ucitel/prezentace?open=${(data as any).id}`);
    } catch (e: any) {
      toast({
        title: "Kopii se nepodařilo uložit",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-h-[92vh] w-[96vw] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 py-3 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <DialogTitle className="text-sm font-medium">
              Náhled prezentace{slides.length > 0 ? ` – snímek ${index + 1} / ${slides.length}` : ""}
            </DialogTitle>
            {slides.length > 0 && (
              <Button size="sm" variant="outline" onClick={saveAsEditableCopy} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Uložit jako upravitelnou kopii
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
          {slides.length === 0 ? (
            <p className="text-muted-foreground text-sm py-12 text-center">
              Z obsahu lekce se zatím nedá vytvořit žádný snímek.
            </p>
          ) : (
            <>
              <div className="min-h-0 flex-1">
                {canvasSlide && <PreviewSlideStage slide={canvasSlide} />}
              </div>

              <div className="flex shrink-0 items-center justify-center gap-3">
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

              <div className="flex shrink-0 gap-2 overflow-x-auto pb-1">
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

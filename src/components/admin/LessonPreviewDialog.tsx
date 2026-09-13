import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { HERO_IMAGE_CLASS } from "@/lib/image-block-layout";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw } from "lucide-react";
import type { Block } from "@/lib/textbook-config";
import { LessonBlock } from "@/components/LessonBlockRenderer";

interface Props {
  title: string;
  heroImageUrl: string | null;
  /** Bloky předané dopředu. Když chybí, načtou se líně podle `lessonId` až při otevření. */
  blocks?: Block[];
  /** Id lekce pro líné dotažení obsahu (seznam lekcí pak nemusí tahat všechny bloky). */
  lessonId?: string;
  /** Zdrojová tabulka pro líné načtení. */
  lessonSource?: "global" | "teacher";
  /** Kompaktní ikonové tlačítko (pro úzké panely). */
  compact?: boolean;
}

const LessonPreviewDialog = ({ title, heroImageUrl, blocks, lessonId, lessonSource = "global", compact = false }: Props) => {
  const [open, setOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [lazyBlocks, setLazyBlocks] = useState<Block[] | null>(null);
  const [lazyHero, setLazyHero] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || blocks || !lessonId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const table = lessonSource === "teacher" ? "teacher_textbook_lessons" : "textbook_lessons";
      const { data } = await supabase.from(table as any).select("*").eq("id", lessonId).maybeSingle();
      if (cancelled) return;
      setLazyBlocks(Array.isArray((data as any)?.blocks) ? ((data as any).blocks as Block[]) : []);
      setLazyHero(typeof (data as any)?.hero_image_url === "string" ? (data as any).hero_image_url : null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, blocks, lessonId, lessonSource, refreshKey]);

  const effectiveBlocks = blocks ?? lazyBlocks ?? [];
  const visibleBlocks = effectiveBlocks.filter((b) => b.visible !== false);
  const effectiveHero = heroImageUrl ?? lazyHero;

  return (
    <>
      {compact ? (
        <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setOpen(true)} title="Náhled lekce">
          <Eye className="w-3.5 h-3.5" />
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Eye className="w-4 h-4 mr-1" />Náhled
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
          <DialogHeader className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex flex-row items-center justify-between">
            <DialogTitle className="text-sm font-medium">Náhled lekce</DialogTitle>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="ml-auto mr-8"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1" />Obnovit
            </Button>
          </DialogHeader>

          {/* Render preview in frontend styles */}
          <div key={refreshKey} className="bg-background px-4 py-8">
            <div className="mx-auto max-w-3xl">
              {heroImageUrl && (
                <img
                  src={heroImageUrl}
                  alt={title}
                  className={`mb-8 ${HERO_IMAGE_CLASS}`}
                />
              )}
              <h1 className="font-heading text-4xl md:text-5xl font-bold mb-10 text-foreground">
                {title || "Bez názvu"}
              </h1>

              <div className="space-y-6">
                {visibleBlocks.map((block) => (
                  <LessonBlock key={block.id} block={block} />
                ))}
              </div>

              {visibleBlocks.length === 0 && (
                <p className="text-muted-foreground">
                  {loading ? "Načítám obsah lekce…" : "Obsah lekce se připravuje."}
                </p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LessonPreviewDialog;

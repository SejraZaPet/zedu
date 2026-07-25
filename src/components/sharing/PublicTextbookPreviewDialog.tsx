import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, BookOpen } from "lucide-react";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import {
  getPublicTextbookOutline,
  getPublicTextbookFirstLesson,
  type PublicTextbookOutline,
  type PublicTextbookFirstLesson,
} from "@/lib/content-shares";
import type { Block } from "@/lib/textbook-config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  textbookId: string | null;
  textbookTitle: string;
}

export default function PublicTextbookPreviewDialog({
  open,
  onOpenChange,
  textbookId,
  textbookTitle,
}: Props) {
  const [outline, setOutline] = useState<PublicTextbookOutline | null>(null);
  const [lesson, setLesson] = useState<PublicTextbookFirstLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !textbookId) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    setOutline(null);
    setLesson(null);
    (async () => {
      try {
        const [o, l] = await Promise.all([
          getPublicTextbookOutline(textbookId),
          getPublicTextbookFirstLesson(textbookId),
        ]);
        if (cancel) return;
        setOutline(o);
        setLesson(l);
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Náhled se nepodařilo načíst.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, textbookId]);

  const visibleBlocks: Block[] = (lesson?.blocks ?? []).filter(
    (b: any) => b?.visible !== false,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3">
          <DialogTitle className="text-sm font-medium">
            Náhled první lekce zdarma · {textbookTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-6">
          {loading && (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && !loading && (
            <div className="text-sm text-destructive">{error}</div>
          )}

          {!loading && !error && (
            <>
              {outline && (
                <section className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold text-sm">Obsah učebnice</h3>
                    <Badge variant="secondary" className="text-[10px]">
                      {outline.total_lessons} lekcí
                    </Badge>
                  </div>
                  {outline.chapters.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Učebnice zatím neobsahuje žádné publikované lekce.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                      {outline.chapters.map((ch) => (
                        <li
                          key={ch.id}
                          className="flex items-center justify-between px-4 py-2.5 bg-card"
                        >
                          <span className="text-sm">{ch.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {ch.lesson_count}{" "}
                            {ch.lesson_count === 1
                              ? "lekce"
                              : ch.lesson_count < 5
                              ? "lekce"
                              : "lekcí"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {lesson ? (
                <section>
                  <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                    Ukázka · první lekce
                  </div>
                  {lesson.hero_image_url && (
                    <img
                      src={lesson.hero_image_url}
                      alt={lesson.title}
                      className="w-full rounded-lg mb-6 object-cover max-h-72"
                    />
                  )}
                  <h1 className="font-heading text-3xl md:text-4xl font-bold mb-8 text-foreground">
                    {lesson.title}
                  </h1>

                  {/* Read-only render: no onActivityComplete → interactive activities render without progress persistence */}
                  <div
                    className="space-y-6 pointer-events-auto select-text"
                    aria-label="Náhled lekce (jen pro čtení)"
                  >
                    {visibleBlocks.map((block) => (
                      <LessonBlock key={block.id} block={block} />
                    ))}
                    {visibleBlocks.length === 0 && (
                      <p className="text-muted-foreground">
                        Tato lekce zatím nemá viditelný obsah.
                      </p>
                    )}
                  </div>

                  {outline && outline.total_lessons > 1 && (
                    <div className="mt-10 rounded-xl border border-border bg-muted/40 px-5 py-6 text-center">
                      <Lock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm font-medium">
                        Zbylých {outline.total_lessons - 1}{" "}
                        {outline.total_lessons - 1 === 1
                          ? "lekce"
                          : outline.total_lessons - 1 < 5
                          ? "lekce"
                          : "lekcí"}{" "}
                        je dostupných po přidání učebnice do vašich materiálů.
                      </p>
                    </div>
                  )}
                </section>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Pro tuto učebnici zatím není k dispozici žádná lekce k náhledu.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

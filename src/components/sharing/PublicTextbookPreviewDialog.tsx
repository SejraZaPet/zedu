import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, BookOpen, Clock, ChevronRight } from "lucide-react";
import { LessonBlock } from "@/components/LessonBlockRenderer";
import {
  getPublicTextbookOutline,
  getPublicTextbookFirstLesson,
  getPublicTextbookAllLessons,
  getUsageCounts,
  type PublicTextbookOutline,
  type PublicTextbookFirstLesson,
  type PublicTextbookLessonFull,
} from "@/lib/content-shares";
import type { Block } from "@/lib/textbook-config";

type Mode = "first" | "trial";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  textbookId: string | null;
  textbookTitle: string;
  mode?: Mode;
  /** ISO expires_at, only used when mode === "trial" */
  trialExpiresAt?: string | null;
}

export default function PublicTextbookPreviewDialog({
  open,
  onOpenChange,
  textbookId,
  textbookTitle,
  mode = "first",
  trialExpiresAt,
}: Props) {
  const [outline, setOutline] = useState<PublicTextbookOutline | null>(null);
  const [firstLesson, setFirstLesson] = useState<PublicTextbookFirstLesson | null>(null);
  const [allLessons, setAllLessons] = useState<PublicTextbookLessonFull[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usageCount, setUsageCount] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !textbookId) {
      setUsageCount(null);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const m = await getUsageCounts({ textbookIds: [textbookId] });
        if (!cancel) setUsageCount(m.get(`textbook:${textbookId}`) ?? 0);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, textbookId]);

  useEffect(() => {
    if (!open || !textbookId) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    setOutline(null);
    setFirstLesson(null);
    setAllLessons([]);
    setActiveId(null);
    (async () => {
      try {
        const [o, content] = await Promise.all([
          getPublicTextbookOutline(textbookId),
          mode === "trial"
            ? getPublicTextbookAllLessons(textbookId)
            : getPublicTextbookFirstLesson(textbookId),
        ]);
        if (cancel) return;
        setOutline(o);
        if (mode === "trial") {
          const list = content as PublicTextbookLessonFull[];
          setAllLessons(list);
          setActiveId(list[0]?.id ?? null);
        } else {
          setFirstLesson(content as PublicTextbookFirstLesson | null);
        }
      } catch (e: any) {
        if (!cancel) setError(e?.message ?? "Náhled se nepodařilo načíst.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open, textbookId, mode]);

  const activeLesson = useMemo(
    () => allLessons.find((l) => l.id === activeId) ?? null,
    [allLessons, activeId],
  );

  const displayedBlocks: Block[] =
    mode === "trial"
      ? ((activeLesson?.blocks ?? []) as Block[]).filter((b: any) => b?.visible !== false)
      : ((firstLesson?.blocks ?? []) as Block[]).filter((b: any) => b?.visible !== false);

  const displayedTitle = mode === "trial" ? activeLesson?.title : firstLesson?.title;
  const displayedHero = mode === "trial" ? activeLesson?.hero_image_url : firstLesson?.hero_image_url;

  const trialDaysLeft = useMemo(() => {
    if (!trialExpiresAt) return null;
    const ms = new Date(trialExpiresAt).getTime() - Date.now();
    if (ms <= 0) return 0;
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }, [trialExpiresAt]);

  // Group lessons by chapter for trial sidebar
  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; sort: number; items: PublicTextbookLessonFull[] }>();
    for (const l of allLessons) {
      const key = l.topic_id ?? "__no_topic__";
      const existing = map.get(key);
      if (existing) existing.items.push(l);
      else
        map.set(key, {
          title: l.topic_title ?? "Ostatní lekce",
          sort: l.topic_sort_order,
          items: [l],
        });
    }
    return Array.from(map.values()).sort((a, b) => a.sort - b.sort);
  }, [allLessons]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-hidden p-0 flex flex-col">
        <DialogHeader className="sticky top-0 z-10 bg-background border-b border-border px-6 py-3 flex flex-row items-center justify-between gap-3">
          <DialogTitle className="text-sm font-medium">
            {mode === "trial" ? "Zkušební přístup" : "Náhled první lekce zdarma"} · {textbookTitle}
          </DialogTitle>
          {mode === "trial" && trialDaysLeft !== null && (
            <Badge variant="secondary" className="text-[10px] flex items-center gap-1 mr-8">
              <Clock className="w-3 h-3" />
              {trialDaysLeft > 0
                ? `Zbývá ${trialDaysLeft} ${trialDaysLeft === 1 ? "den" : trialDaysLeft < 5 ? "dny" : "dní"}`
                : "Vypršel"}
            </Badge>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex">
          {mode === "trial" && (
            <aside className="w-72 shrink-0 border-r border-border overflow-y-auto bg-muted/20">
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                  <BookOpen className="w-3.5 h-3.5" />
                  Obsah učebnice
                </div>
                {outline && (
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {outline.total_lessons} lekcí
                  </div>
                )}
              </div>
              <nav className="py-2">
                {grouped.map((g, gi) => (
                  <div key={gi} className="mb-2">
                    <div className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.title}
                    </div>
                    <ul>
                      {g.items.map((l) => (
                        <li key={l.id}>
                          <button
                            type="button"
                            onClick={() => setActiveId(l.id)}
                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-muted transition-colors ${
                              activeId === l.id ? "bg-muted font-medium text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            <ChevronRight className="w-3 h-3 shrink-0 opacity-60" />
                            <span className="truncate">{l.title}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </aside>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {loading && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}
            {error && !loading && <div className="text-sm text-destructive">{error}</div>}

            {!loading && !error && (
              <>
                {mode === "first" && outline && (
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

                {displayedTitle ? (
                  <section>
                    {mode === "first" && (
                      <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Ukázka · první lekce
                      </div>
                    )}
                    {displayedHero && (
                      <img
                        src={displayedHero}
                        alt={displayedTitle}
                        className="w-full rounded-lg mb-6 object-cover max-h-72"
                      />
                    )}
                    <h1 className="font-heading text-3xl md:text-4xl font-bold mb-8 text-foreground">
                      {displayedTitle}
                    </h1>

                    <div
                      className="space-y-6 select-text"
                      aria-label="Náhled lekce (jen pro čtení)"
                    >
                      {displayedBlocks.map((block) => (
                        <LessonBlock key={block.id} block={block} />
                      ))}
                      {displayedBlocks.length === 0 && (
                        <p className="text-muted-foreground">
                          Tato lekce zatím nemá viditelný obsah.
                        </p>
                      )}
                    </div>

                    {mode === "first" && outline && outline.total_lessons > 1 && (
                      <div className="mt-10 rounded-xl border border-border bg-muted/40 px-5 py-6 text-center">
                        <Lock className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          Zbylých {outline.total_lessons - 1}{" "}
                          {outline.total_lessons - 1 === 1
                            ? "lekce"
                            : outline.total_lessons - 1 < 5
                            ? "lekce"
                            : "lekcí"}{" "}
                          je dostupných po přidání učebnice do vašich materiálů nebo přes zkušební přístup.
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
        </div>
      </DialogContent>
    </Dialog>
  );
}

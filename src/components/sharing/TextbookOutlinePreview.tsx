import { useEffect, useState } from "react";
import { getPublicTextbookOutline, type PublicTextbookOutline } from "@/lib/content-shares";
import { Loader2 } from "lucide-react";

const pluralLekcí = (n: number) =>
  n === 1 ? "lekce" : n < 5 ? "lekce" : "lekcí";

export default function TextbookOutlinePreview({ textbookId }: { textbookId: string }) {
  const [outline, setOutline] = useState<PublicTextbookOutline | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    (async () => {
      try {
        const o = await getPublicTextbookOutline(textbookId);
        if (!cancel) setOutline(o);
      } catch {
        /* silent */
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [textbookId]);

  if (loading) {
    return (
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Loader2 className="w-3 h-3 animate-spin" />
        Načítání obsahu…
      </div>
    );
  }
  if (!outline) return null;

  if (outline.chapters.length === 0) {
    return (
      <div className="text-[11px] text-muted-foreground">
        {outline.total_lessons} {pluralLekcí(outline.total_lessons)}
      </div>
    );
  }

  const visible = outline.chapters.slice(0, 4);
  const remaining = outline.chapters.length - visible.length;

  return (
    <div className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-[11px]">
      <div className="mb-1 font-medium text-foreground/80">
        Obsah · {outline.total_lessons} {pluralLekcí(outline.total_lessons)}
      </div>
      <ul className="space-y-0.5">
        {visible.map((ch) => (
          <li key={ch.id} className="flex justify-between gap-2">
            <span className="truncate text-muted-foreground">{ch.title}</span>
            <span className="shrink-0 text-muted-foreground">
              {ch.lesson_count} {pluralLekcí(ch.lesson_count)}
            </span>
          </li>
        ))}
        {remaining > 0 && (
          <li className="text-muted-foreground/70">
            + {remaining} další{remaining === 1 ? "" : "ch"} kapitol
          </li>
        )}
      </ul>
    </div>
  );
}

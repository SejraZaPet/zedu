import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Puzzle } from "lucide-react";

export interface MyActivityItem {
  key: string;
  lessonTitle: string;
  title: string;
  activityType: string;
  block: any;
}

const ACTIVITY_LABELS: Record<string, string> = {
  quiz: "Kvíz",
  true_false: "Pravda / Nepravda",
  poll: "Hlasování",
  wall: "Zeď odpovědí",
  flashcards: "Kartičky",
  matching: "Párování",
  ordering: "Seřazení",
  sorting: "Třídění",
  fill_blanks: "Doplňovačka",
  fill_choice: "Doplňovačka s výběrem",
  image_label: "Obrázek s popisem",
  image_hotspot: "Aktivní body",
  reveal_cards: "Odhalovací karty",
  memory_game: "Pexeso",
  crossword: "Křížovka",
  open: "Otevřená odpověď",
  summary: "Shrnutí",
};

/** Seznam vlastních aktivit učitele napříč jeho lekcemi (max 20 nejnovějších). */
export const MyLessonActivitiesList = ({
  onPick,
}: {
  onPick: (item: MyActivityItem) => void;
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<MyActivityItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(false);
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        if (!cancelled) { setLoading(false); setError(true); }
        return;
      }
      const { data, error: err } = await supabase
        .from("teacher_textbook_lessons")
        .select("id, title, blocks, created_at, teacher_textbooks!inner(teacher_id)")
        .eq("teacher_textbooks.teacher_id", userId)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      if (err) {
        console.error("Nepodařilo se načíst vlastní aktivity", err);
        setError(true);
        setLoading(false);
        return;
      }
      const collected: MyActivityItem[] = [];
      for (const lesson of (data as any[]) || []) {
        const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
        blocks.forEach((block: any, i: number) => {
          if (block?.type !== "activity") return;
          const props = block.props || {};
          collected.push({
            key: `${lesson.id}-${block.id || i}`,
            lessonTitle: lesson.title || "Bez názvu",
            title: String(props.title || props.question || "Aktivita"),
            activityType: String(props.activityType || "quiz"),
            block,
          });
        });
        if (collected.length >= 20) break;
      }
      setItems(collected.slice(0, 20));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Načítání aktivit…
      </p>
    );
  }
  if (error) {
    return <p className="px-1 py-2 text-xs text-destructive">Aktivity se nepodařilo načíst.</p>;
  }
  if (items.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Ve svých lekcích zatím nemáte žádné aktivity.</p>;
  }

  return (
    <div className="space-y-1">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onPick(item)}
          className="flex w-full items-start gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-primary/60 hover:bg-muted/60"
        >
          <Puzzle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block truncate text-[11px] font-medium text-foreground">{item.title}</span>
            <span className="block truncate text-[10px] text-muted-foreground">
              {ACTIVITY_LABELS[item.activityType] || item.activityType} · {item.lessonTitle}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
};

export default MyLessonActivitiesList;

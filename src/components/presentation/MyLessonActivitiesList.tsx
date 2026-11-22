import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Puzzle, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { activityTypeLabel } from "@/lib/presentation-activity";
import { collectActivityBlocks, collectStudioActivities, type StudioActivity } from "@/lib/presentation-activity-sources";
import { fetchGameTemplates } from "@/lib/game-templates";

export interface MyActivityItem {
  key: string;
  lessonTitle: string;
  title: string;
  activityType: string;
  block: any;
}

export const LESSONS_PAGE_SIZE = 30;

/**
 * Aktivity učitele pro vložení do prezentace: z vlastních lekcí (i vnořené ve sloupcích
 * a skupinách, stránkování) a ze sad ve Studiu. Čte jen vlastní data přes RLS.
 */
export const MyLessonActivitiesList = ({
  onPick,
  onPickStudio,
  defaultTab = "lessons",
}: {
  onPick: (item: MyActivityItem) => void;
  onPickStudio?: (item: StudioActivity) => void;
  defaultTab?: "lessons" | "studio";
}) => {
  const [tab, setTab] = useState<"lessons" | "studio">(defaultTab);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [items, setItems] = useState<MyActivityItem[]>([]);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [studio, setStudio] = useState<StudioActivity[] | null>(null);
  const [studioError, setStudioError] = useState(false);

  const loadPage = useCallback(async (p: number) => {
    setLoading(true);
    setError(false);
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { setLoading(false); setError(true); return; }
    const from = p * LESSONS_PAGE_SIZE;
    const { data, error: err } = await supabase
      .from("teacher_textbook_lessons")
      .select("id, title, blocks, created_at, teacher_textbooks!inner(teacher_id)")
      .eq("teacher_textbooks.teacher_id", userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + LESSONS_PAGE_SIZE - 1);
    if (err) { setError(true); setLoading(false); return; }
    const rows = (data as any[]) || [];
    const collected: MyActivityItem[] = [];
    for (const lesson of rows) {
      for (const { block, path } of collectActivityBlocks(lesson.blocks)) {
        const props = block.props || {};
        collected.push({
          key: `${lesson.id}-${block.id || path}`,
          lessonTitle: lesson.title || "Bez názvu",
          title: String(props.title || props.question || "Aktivita"),
          activityType: String(props.activityType || "quiz"),
          block,
        });
      }
    }
    setItems((prev) => (p === 0 ? collected : [...prev, ...collected]));
    setHasMore(rows.length === LESSONS_PAGE_SIZE);
    setPage(p);
    setLoading(false);
  }, []);

  useEffect(() => { void loadPage(0); }, [loadPage]);

  useEffect(() => {
    if (tab !== "studio" || studio) return;
    fetchGameTemplates()
      .then((t) => setStudio(collectStudioActivities(t as any)))
      .catch(() => setStudioError(true));
  }, [tab, studio]);

  const row = (key: string, title: string, sub: string, onClick: () => void, Icon = Puzzle) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left transition-colors hover:border-deck-teal hover:bg-deck-cream"
    >
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-deck-violet" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11px] font-medium text-foreground">{title}</span>
        <span className="block truncate text-[10px] text-muted-foreground">{sub}</span>
      </span>
      <span className="shrink-0 rounded-md bg-deck-soft px-2 py-1 text-[10px] font-semibold text-deck-violet">Vložit</span>
    </button>
  );

  const normalizedQuery = query.trim().toLocaleLowerCase("cs");
  const matches = (...values: string[]) => !normalizedQuery || values.join(" ").toLocaleLowerCase("cs").includes(normalizedQuery);
  const visibleItems = items.filter((item) => matches(item.title, item.lessonTitle, activityTypeLabel(item.activityType)));
  const visibleStudio = studio?.filter((item) => matches(item.title, item.templateTitle, activityTypeLabel(item.activityType)));

  return (
    <div className="space-y-3 font-deck-body">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-deck-muted" />
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Hledat název, lekci nebo typ…" aria-label="Hledat aktivity" className="border-deck-line pl-8" />
      </div>
      {onPickStudio && (
        <div role="tablist" aria-label="Zdroj aktivit" className="grid grid-cols-2 gap-1 rounded-lg bg-deck-cream p-1">
          {([["lessons", "Z lekcí"], ["studio", "Ze Studia"]] as const).map(([v, l]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold ${tab === v ? "bg-deck-violet text-primary-foreground" : "text-deck-violet-deep hover:bg-background"}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}

      {tab === "lessons" ? (
        <>
          {error && <p className="px-1 py-2 text-xs text-destructive">Aktivity se nepodařilo načíst.</p>}
          {!error && !loading && visibleItems.length === 0 && !hasMore && (
            <p className="px-1 py-2 text-xs text-muted-foreground">{items.length ? "Hledání neodpovídá žádná aktivita." : "Ve svých lekcích zatím nemáte žádné aktivity."}</p>
          )}
          <div className="space-y-1">
            {visibleItems.map((item) => row(item.key, item.title, `${activityTypeLabel(item.activityType)} · ${item.lessonTitle}`, () => onPick(item)))}
          </div>
          {loading ? (
            <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Načítání aktivit…
            </p>
          ) : hasMore ? (
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => void loadPage(page + 1)}>
              Načíst další lekce
            </Button>
          ) : null}
        </>
      ) : studioError ? (
        <p className="px-1 py-2 text-xs text-destructive">Sady ze Studia se nepodařilo načíst.</p>
      ) : !studio ? (
        <p className="flex items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Načítání Studia…
        </p>
      ) : !visibleStudio?.length ? (
        <p className="px-1 py-2 text-xs text-muted-foreground">{studio.length ? "Hledání neodpovídá žádná aktivita." : "Ve Studiu zatím nemáte žádnou sadu s aktivitou."}</p>
      ) : (
        <div className="space-y-1">
          {visibleStudio.map((s) => row(s.key, s.title, `${activityTypeLabel(s.activityType)} · ${s.templateTitle}`, () => onPickStudio?.(s), Sparkles))}
        </div>
      )}
    </div>
  );
};

export default MyLessonActivitiesList;

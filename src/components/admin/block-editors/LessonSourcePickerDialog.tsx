import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { blockToPlainText } from "@/lib/block-conversions";
import type { Block } from "@/lib/textbook-config";

/** Maximální délka podkladu pro AI – delší text se zkrátí s upozorněním. */
export const MAX_AI_SOURCE_CHARS = 6000;

type LessonRef = {
  id: string;
  title: string;
  /** true = lekce z učitelské učebnice (teacher_textbook_lessons) */
  teacher: boolean;
};

type LessonGroup = {
  key: string;
  label: string;
  lessons: LessonRef[];
};

/** Jedna sekce (blok) uvnitř lekce – nabízí se po rozbalení lekce. */
type SectionRef = {
  key: string;
  label: string;
  text: string;
};

/**
 * Cache seznamu lekcí mezi otevřeními dialogu – seznam se nemění často,
 * takže se nestahuje znovu při každém otevření (zdrojem pomalého načítání).
 */
let groupsCache: LessonGroup[] | null = null;
let groupsCacheAt = 0;
const GROUPS_CACHE_TTL_MS = 5 * 60 * 1000;

/** Cache obsahu jednotlivých lekcí (sekce) v rámci session. */
const sectionsCache = new Map<string, SectionRef[]>();

const sectionLabel = (text: string, index: number) => {
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  const short = firstLine.length > 70 ? `${firstLine.slice(0, 70)}…` : firstLine;
  return short || `Sekce ${index + 1}`;
};

/**
 * Výběr obsahu z jiných lekcí (napříč tématy a učebnicemi) jako podklad pro AI.
 * Kromě celých lekcí lze vybírat i jednotlivé sekce konkrétní lekce.
 */
const LessonSourcePickerDialog = ({
  open,
  onOpenChange,
  onPicked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPicked: (text: string, truncated: boolean) => void;
}) => {
  const [groups, setGroups] = useState<LessonGroup[]>(
    groupsCache && Date.now() - groupsCacheAt < GROUPS_CACHE_TTL_MS ? groupsCache : [],
  );
  const [loading, setLoading] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, LessonRef>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sections, setSections] = useState<Record<string, SectionRef[]>>({});
  const [sectionsLoading, setSectionsLoading] = useState<Record<string, boolean>>({});
  /** Vybrané sekce: lessonId -> { sectionKey: text } */
  const [selectedSections, setSelectedSections] = useState<
    Record<string, Record<string, string>>
  >({});

  const loadedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    // Cache jen z úspěšného (neprázdného) načtení; jinak zkusit znovu.
    if (loadedRef.current || groups.length > 0) return;
    loadedRef.current = true;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [topicsRes, globalRes, myBooksRes, myLessonsRes] = await Promise.all([
          supabase.from("textbook_topics").select("id, title, subject, grade").order("title").limit(500),
          supabase.from("textbook_lessons").select("id, title, topic_id").order("sort_order").limit(2000),
          supabase.from("teacher_textbooks").select("id, title").is("deleted_at", null).order("title").limit(200),
          supabase
            .from("teacher_textbook_lessons")
            .select("id, title, textbook_id")
            .order("sort_order")
            .limit(2000),
        ]);
        if (cancelled) {
          loadedRef.current = false;
          return;
        }

        const topics = (topicsRes.data as any[]) ?? [];
        const globalLessons = (globalRes.data as any[]) ?? [];
        const books = (myBooksRes.data as any[]) ?? [];
        const myLessons = (myLessonsRes.data as any[]) ?? [];

        const next: LessonGroup[] = [];
        for (const t of topics) {
          const lessons = globalLessons
            .filter((l) => l.topic_id === t.id)
            .map((l) => ({ id: l.id, title: l.title ?? "Bez názvu", teacher: false }));
          if (lessons.length === 0) continue;
          const meta = [t.subject, t.grade ? `${t.grade}. ročník` : null].filter(Boolean).join(" · ");
          next.push({
            key: `topic-${t.id}`,
            label: meta ? `${t.title} (${meta})` : t.title,
            lessons,
          });
        }
        for (const b of books) {
          const lessons = myLessons
            .filter((l) => l.textbook_id === b.id)
            .map((l) => ({ id: l.id, title: l.title ?? "Bez názvu", teacher: true }));
          if (lessons.length === 0) continue;
          next.push({ key: `book-${b.id}`, label: `${b.title} (moje učebnice)`, lessons });
        }
        if (next.length > 0) {
          groupsCache = next;
          groupsCacheAt = Date.now();
        } else {
          groupsCache = null;
          loadedRef.current = false;
          const firstError =
            topicsRes.error || globalRes.error || (myBooksRes as any).error || (myLessonsRes as any).error;
          if (firstError) setError(firstError.message || "Lekce se nepodařilo načíst.");
        }
        setGroups(next);
      } catch (e: any) {
        loadedRef.current = false;
        if (!cancelled) setError(e?.message || "Lekce se nepodařilo načíst.");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadSections = async (lesson: LessonRef) => {
    if (sections[lesson.id] || sectionsCache.has(lesson.id)) {
      if (!sections[lesson.id]) {
        setSections((prev) => ({ ...prev, [lesson.id]: sectionsCache.get(lesson.id)! }));
      }
      return;
    }
    setSectionsLoading((prev) => ({ ...prev, [lesson.id]: true }));
    try {
      const table = lesson.teacher ? "teacher_textbook_lessons" : "textbook_lessons";
      const { data, error: err } = await supabase
        .from(table as any)
        .select("blocks")
        .eq("id", lesson.id)
        .maybeSingle();
      if (err) throw err;
      const blocks: Block[] = Array.isArray((data as any)?.blocks) ? ((data as any).blocks as Block[]) : [];
      const list: SectionRef[] = [];
      blocks.forEach((b, i) => {
        const text = blockToPlainText(b).trim();
        if (!text) return;
        list.push({ key: (b as any).id || `i-${i}`, label: sectionLabel(text, i), text });
      });
      sectionsCache.set(lesson.id, list);
      setSections((prev) => ({ ...prev, [lesson.id]: list }));
    } catch (e: any) {
      setError(e?.message || "Sekce lekce se nepodařilo načíst.");
    } finally {
      setSectionsLoading((prev) => ({ ...prev, [lesson.id]: false }));
    }
  };

  const toggleExpand = (lesson: LessonRef) => {
    const next = !expanded[lesson.id];
    setExpanded((prev) => ({ ...prev, [lesson.id]: next }));
    if (next) void loadSections(lesson);
  };

  const q = search.trim().toLowerCase();
  const visible = groups
    .map((g) => ({
      ...g,
      lessons: q
        ? g.lessons.filter(
            (l) => l.title.toLowerCase().includes(q) || g.label.toLowerCase().includes(q),
          )
        : g.lessons,
    }))
    .filter((g) => g.lessons.length > 0);

  const toggleLesson = (lesson: LessonRef) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[lesson.id]) delete next[lesson.id];
      else next[lesson.id] = lesson;
      return next;
    });

  const toggleSection = (lesson: LessonRef, section: SectionRef) => {
    setSelectedSections((prev) => {
      const forLesson = { ...(prev[lesson.id] ?? {}) };
      if (forLesson[section.key]) delete forLesson[section.key];
      else forLesson[section.key] = section.text;
      const next = { ...prev };
      if (Object.keys(forLesson).length === 0) delete next[lesson.id];
      else next[lesson.id] = forLesson;
      return next;
    });
    // Výběr sekcí a celé lekce se vylučuje – sekce mají přednost.
    setSelected((prev) => {
      if (!prev[lesson.id]) return prev;
      const next = { ...prev };
      delete next[lesson.id];
      return next;
    });
  };

  const toggleGroup = (group: LessonGroup) => {
    const allSelected = group.lessons.every((l) => selected[l.id]);
    setSelected((prev) => {
      const next = { ...prev };
      for (const l of group.lessons) {
        if (allSelected) delete next[l.id];
        else next[l.id] = l;
      }
      return next;
    });
  };

  const confirm = async () => {
    const picked = Object.values(selected);
    const sectionLessonIds = Object.keys(selectedSections);
    if (picked.length === 0 && sectionLessonIds.length === 0) return;
    setCollecting(true);
    setError(null);
    try {
      const parts: string[] = [];

      // 1) Vybrané jednotlivé sekce (text už máme z rozbalení).
      const titleByLesson = new Map<string, string>();
      for (const g of groups) for (const l of g.lessons) titleByLesson.set(l.id, l.title);
      for (const lessonId of sectionLessonIds) {
        const texts = Object.values(selectedSections[lessonId] ?? {}).filter(Boolean);
        if (!texts.length) continue;
        parts.push(`## ${titleByLesson.get(lessonId) ?? "Lekce"}\n${texts.join("\n\n")}`);
      }

      // 2) Celé vybrané lekce.
      const globalIds = picked.filter((l) => !l.teacher).map((l) => l.id);
      const teacherIds = picked.filter((l) => l.teacher).map((l) => l.id);
      const [globalRes, teacherRes] = await Promise.all([
        globalIds.length
          ? supabase.from("textbook_lessons").select("id, title, blocks").in("id", globalIds)
          : Promise.resolve({ data: [] as any[] }),
        teacherIds.length
          ? supabase
              .from("teacher_textbook_lessons")
              .select("id, title, blocks")
              .in("id", teacherIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const rows = [
        ...(((globalRes as any).data as any[]) ?? []),
        ...(((teacherRes as any).data as any[]) ?? []),
      ];

      for (const row of rows) {
        const blocks: Block[] = Array.isArray(row.blocks) ? (row.blocks as Block[]) : [];
        const text = blocks
          .map((b) => blockToPlainText(b).trim())
          .filter(Boolean)
          .join("\n");
        if (text) parts.push(`## ${row.title ?? "Lekce"}\n${text}`);
      }

      const joined = parts.join("\n\n").trim();
      if (!joined) {
        setError("Vybraný obsah neobsahuje žádný text.");
        return;
      }
      const truncated = joined.length > MAX_AI_SOURCE_CHARS;
      onPicked(truncated ? `${joined.slice(0, MAX_AI_SOURCE_CHARS)}…` : joined, truncated);
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Obsah lekcí se nepodařilo načíst.");
    } finally {
      setCollecting(false);
    }
  };

  const selectedSectionCount = Object.values(selectedSections).reduce(
    (sum, m) => sum + Object.keys(m).length,
    0,
  );
  const selectedCount = Object.keys(selected).length + selectedSectionCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vybrat obsah z lekcí</DialogTitle>
          <DialogDescription>
            Zaškrtněte celé lekce, nebo lekci rozbalte a vyberte jen konkrétní sekce, ze kterých má
            AI vycházet.
          </DialogDescription>
        </DialogHeader>

        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Hledat lekci nebo téma…"
        />

        <ScrollArea className="h-80 rounded-md border border-border">
          <div className="p-2 space-y-3">
            {loading && <p className="p-2 text-xs text-muted-foreground">Načítám lekce…</p>}
            {!loading && visible.length === 0 && (
              <p className="p-2 text-xs text-muted-foreground">Žádné lekce k výběru.</p>
            )}
            {visible.map((g) => {
              const all = g.lessons.every((l) => selected[l.id]);
              return (
                <div key={g.key} className="space-y-1">
                  <label className="flex items-center gap-2 rounded-md bg-muted/50 px-2 py-1.5 cursor-pointer">
                    <Checkbox checked={all} onCheckedChange={() => toggleGroup(g)} />
                    <span className="text-xs font-semibold">
                      {g.label} · Vybrat celé téma ({g.lessons.length})
                    </span>
                  </label>
                  <div className="pl-4 space-y-0.5">
                    {g.lessons.map((l) => {
                      const isOpen = !!expanded[l.id];
                      const secs = sections[l.id] ?? [];
                      const pickedSecs = selectedSections[l.id] ?? {};
                      return (
                        <div key={l.id}>
                          <div className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-muted/60">
                            <button
                              type="button"
                              onClick={() => toggleExpand(l)}
                              aria-label={`Zobrazit sekce lekce ${l.title}`}
                              className="p-0.5 text-muted-foreground hover:text-foreground"
                            >
                              {isOpen ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </button>
                            <label className="flex flex-1 items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={!!selected[l.id]}
                                onCheckedChange={() => toggleLesson(l)}
                              />
                              <span className="text-xs">{l.title}</span>
                              {Object.keys(pickedSecs).length > 0 && (
                                <span className="text-[10px] text-muted-foreground">
                                  ({Object.keys(pickedSecs).length} sekcí)
                                </span>
                              )}
                            </label>
                          </div>
                          {isOpen && (
                            <div className="pl-8 space-y-0.5 pb-1">
                              {sectionsLoading[l.id] && (
                                <p className="text-[11px] text-muted-foreground">Načítám sekce…</p>
                              )}
                              {!sectionsLoading[l.id] && secs.length === 0 && (
                                <p className="text-[11px] text-muted-foreground">
                                  Lekce neobsahuje textové sekce.
                                </p>
                              )}
                              {secs.map((s) => (
                                <label
                                  key={s.key}
                                  className="flex items-start gap-2 rounded-md px-2 py-1 hover:bg-muted/50 cursor-pointer"
                                >
                                  <Checkbox
                                    checked={!!pickedSecs[s.key]}
                                    onCheckedChange={() => toggleSection(l, s)}
                                  />
                                  <span className="text-[11px] leading-snug text-muted-foreground">
                                    {s.label}
                                  </span>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button type="button" onClick={confirm} disabled={selectedCount === 0 || collecting}>
            {collecting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Použít obsah ({selectedCount})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LessonSourcePickerDialog;

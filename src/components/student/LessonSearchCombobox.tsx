import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { matchesSearch } from "@/lib/picker-search";
import { useStudentPracticeLessons } from "@/hooks/useStudentPracticeLessons";
import type { PracticeLessonGroup, PracticeLessonOption } from "@/lib/student-practice-lessons";

export function orderedPracticeLessons(
  groups: PracticeLessonGroup[],
  recentLessonIds: string[] = [],
): PracticeLessonOption[] {
  const rank = new Map(recentLessonIds.map((id, index) => [id, index]));
  return groups
    .flatMap((group) => group.lessons)
    .map((lesson, index) => ({ lesson, index }))
    .sort((a, b) => {
      const aRank = rank.get(a.lesson.id) ?? Number.MAX_SAFE_INTEGER;
      const bRank = rank.get(b.lesson.id) ?? Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.index - b.index;
    })
    .map(({ lesson }) => lesson);
}

function lessonSubtitle(lesson: PracticeLessonOption): string {
  return [lesson.subject, lesson.textbook]
    .filter((part, index, all) => part.trim() && all.indexOf(part) === index)
    .join(" · ");
}

interface LessonSearchComboboxProps {
  userId: string | null;
  recentLessonIds?: string[];
  value: string;
  onValueChange: (lessonId: string) => void;
  disabled?: boolean;
  allowNone?: boolean;
  emptyMessage?: string;
}

/** Sdílený výběr lekce; všechny dialogy čtou stejnou react-query cache. */
export default function LessonSearchCombobox({
  userId,
  recentLessonIds = [],
  value,
  onValueChange,
  disabled = false,
  allowNone = false,
  emptyMessage = "Jakmile ti učitel zveřejní lekci, bude dostupná tady.",
}: LessonSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const lessonsQuery = useStudentPracticeLessons(userId);
  const groups = useMemo(() => lessonsQuery.data ?? [], [lessonsQuery.data]);
  const lessons = useMemo(() => orderedPracticeLessons(groups, recentLessonIds), [groups, recentLessonIds]);
  const visible = lessons.filter((lesson) => matchesSearch(query, lesson.title, lesson.subject, lesson.textbook));
  const showNone = allowNone && (!query.trim() || matchesSearch(query, "Bez konkrétní lekce"));
  const selected = lessons.find((lesson) => lesson.id === value);
  const close = () => { setOpen(false); setQuery(""); };

  if (lessonsQuery.isPending && lessonsQuery.data === undefined) {
    return (
      <div className="mt-1 space-y-2" role="status" aria-live="polite">
        <Skeleton data-testid="lesson-search-skeleton" className="h-11 w-full" />
        <p className="text-xs text-muted-foreground">Načítám tvoje lekce…</p>
      </div>
    );
  }

  if (lessonsQuery.isError) {
    return (
      <div className="mt-1 space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3" role="alert">
        <p className="text-sm font-medium text-foreground">Lekce se nepodařilo načíst</p>
        <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={lessonsQuery.isFetching} onClick={() => { void lessonsQuery.refetch(); }}>
          {lessonsQuery.isFetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Zkusit znovu
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-1 space-y-2">
      <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label="Lekce pro studijní pomůcku"
            aria-expanded={open}
            aria-haspopup="listbox"
            disabled={disabled || (!allowNone && groups.length === 0)}
            className="h-auto min-h-11 w-full min-w-0 justify-between whitespace-normal text-left font-normal"
          >
            <span className="min-w-0 break-words">
              {value === "none" && allowNone ? "Bez konkrétní lekce" : selected?.title || (groups.length || allowNone ? "Vyber lekci" : "Zatím nemáš dostupnou lekci")}
              {selected && <span className="block text-xs text-muted-foreground">{lessonSubtitle(selected)}</span>}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          collisionPadding={8}
          className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1rem)] p-0"
        >
          <Command shouldFilter={false} label="Hledat lekci">
            <CommandInput
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Napiš název lekce, předmětu nebo učebnice…"
              aria-label="Hledat lekci"
            />
            <CommandList className="max-h-[min(300px,45dvh)]">
              {!showNone && visible.length === 0 && (
                <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nic jsme nenašli. Zkus jiné slovo.
                </p>
              )}
              {showNone && (
                <CommandItem
                  value="none"
                  className="min-h-11 gap-2 whitespace-normal px-3 py-2"
                  onSelect={() => { onValueChange("none"); close(); }}
                >
                  <Check aria-hidden className={`h-4 w-4 shrink-0 ${value === "none" ? "opacity-100" : "opacity-0"}`} />
                  <span>Bez konkrétní lekce</span>
                </CommandItem>
              )}
              {visible.map((lesson) => (
                <CommandItem
                  key={lesson.id}
                  value={lesson.id}
                  className="min-h-11 gap-2 whitespace-normal px-3 py-2"
                  onSelect={() => { onValueChange(lesson.id); close(); }}
                >
                  <Check aria-hidden className={`h-4 w-4 shrink-0 ${value === lesson.id ? "opacity-100" : "opacity-0"}`} />
                  <span className="min-w-0 break-words">
                    {lesson.title}
                    <span className="block text-xs text-muted-foreground">{lessonSubtitle(lesson)}</span>
                  </span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {groups.length === 0 && <p className="text-xs text-muted-foreground">{emptyMessage}</p>}
    </div>
  );
}

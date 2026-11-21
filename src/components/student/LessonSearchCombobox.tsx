import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { matchesSearch } from "@/lib/picker-search";
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
  groups: PracticeLessonGroup[];
  recentLessonIds?: string[];
  value: string;
  onValueChange: (lessonId: string) => void;
  disabled?: boolean;
}

/** Sdílený výběr lekce pro studijní dialogy; výběr pouze vrací stávající ID lekce. */
export default function LessonSearchCombobox({
  groups,
  recentLessonIds = [],
  value,
  onValueChange,
  disabled = false,
}: LessonSearchComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const lessons = useMemo(() => orderedPracticeLessons(groups, recentLessonIds), [groups, recentLessonIds]);
  const visible = lessons.filter((lesson) => matchesSearch(query, lesson.title, lesson.subject, lesson.textbook));
  const selected = lessons.find((lesson) => lesson.id === value);
  const close = () => { setOpen(false); setQuery(""); };

  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-label="Lekce pro studijní pomůcku"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          className="h-auto min-h-11 w-full min-w-0 justify-between whitespace-normal text-left font-normal"
        >
          <span className="min-w-0 break-words">
            {selected?.title || (groups.length ? "Vyber lekci" : "Zatím nemáš dostupnou lekci")}
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
            {visible.length === 0 && (
              <p role="status" className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nic jsme nenašli. Zkus jiné slovo.
              </p>
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
  );
}

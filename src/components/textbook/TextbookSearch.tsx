import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { searchLessons, type SearchableLesson } from "@/lib/lesson-text-search";

interface Props {
  lessons: SearchableLesson[];
  onOpen: (lessonId: string) => void;
  placeholder?: string;
  className?: string;
}

/** Vyhledávací pole nad obsahem učebnice – hledá v názvech lekcí i v textu bloků. */
const TextbookSearch = ({ lessons, onOpen, placeholder, className }: Props) => {
  const [query, setQuery] = useState("");
  const hits = useMemo(() => searchLessons(lessons, query), [lessons, query]);
  const active = query.trim().length >= 2;

  return (
    <div className={className}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder || "Hledat v učebnici…"}
          aria-label="Hledat v učebnici"
          className="pl-9 pr-9"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Zrušit hledání"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {active && (
        <div className="mt-3 rounded-lg border border-border bg-card">
          {hits.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nic jsme nenašli. Zkuste jiné slovo.</p>
          ) : (
            <ul className="divide-y divide-border">
              {hits.map((hit) => (
                <li key={hit.lessonId}>
                  <button
                    type="button"
                    onClick={() => onOpen(hit.lessonId)}
                    className="w-full px-4 py-3 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="block text-sm font-medium text-foreground">{hit.title}</span>
                    {hit.snippet && (
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {hit.snippet}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
            Nalezeno lekcí: {hits.length}
          </p>
        </div>
      )}
    </div>
  );
};

export default TextbookSearch;

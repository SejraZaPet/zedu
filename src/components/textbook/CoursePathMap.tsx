import { useEffect, useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ChevronDown, Flag, MapPin, Trophy } from "lucide-react";

const COLLAPSE_KEY = "bezli.textbook.pathCollapsed";
const readCollapsed = () => {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
};

export interface CoursePathItem {
  id: string;
  title: string;
  groupLabel?: string;
  completed?: boolean;
}

interface Props {
  items: CoursePathItem[];
  onSelect?: (id: string) => void;
  /** Zobrazit stav dokončení a ukazatel pokroku (žákovský režim). */
  showProgress?: boolean;
  title?: string;
  description?: string;
  /** Omezená výška seznamu lekcí v px – mapa se scroluje uvnitř karty. */
  maxListHeight?: number;
}

/**
 * Vizuální mapa průchodu kurzem – lekce jako uzly na cestě.
 * Používá se u žáka (s pokrokem) i u učitele (jen přehled struktury).
 */
const CoursePathMap = ({
  items,
  onSelect,
  showProgress = false,
  title = "Průchod kurzem",
  description,
  maxListHeight,
}: Props) => {
  const { completedCount, nextIndex } = useMemo(() => {
    const done = items.filter((i) => i.completed).length;
    const next = items.findIndex((i) => !i.completed);
    return { completedCount: done, nextIndex: next };
  }, [items]);

  const contentId = useId();
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  if (items.length === 0) return null;

  const allDone = showProgress && completedCount === items.length;

  return (
    <section className="bg-card border border-border rounded-xl p-5 mb-6">
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
        aria-controls={contentId}
        className="w-full min-h-11 -my-1 flex items-center justify-between gap-3 flex-wrap rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
      >
        <h2 className="font-heading text-lg font-semibold flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" aria-hidden /> {title}
        </h2>
        <span className="flex items-center gap-2">
        {showProgress ? (
          allDone ? (
            <Badge className="gap-1">
              <Trophy className="w-3 h-3" /> Kurz dokončen
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              {completedCount}/{items.length} lekcí
            </Badge>
          )
        ) : (
          <Badge variant="secondary" className="text-xs">
            {items.length} lekcí
          </Badge>
        )}
          <ChevronDown
            aria-hidden
            className={cn(
              "w-5 h-5 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
              collapsed && "-rotate-90"
            )}
          />
        </span>
      </button>

      <div
        id={contentId}
        aria-hidden={collapsed}
        className={cn(
          "grid transition-[grid-template-rows,opacity,visibility] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "grid-rows-[0fr] opacity-0 invisible" : "grid-rows-[1fr] opacity-100"
        )}
      >
      <div className="overflow-hidden min-w-0">
      <div className="pt-4">
      {description && (
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
      )}

      <div
        className={maxListHeight ? "overflow-y-auto pr-1" : undefined}
        style={maxListHeight ? { maxHeight: maxListHeight } : undefined}
      >
      <ol className="flex flex-wrap items-stretch gap-y-4">
        {items.map((item, idx) => {
          const isNext = showProgress && idx === nextIndex;
          const isDone = showProgress && !!item.completed;
          const isLast = idx === items.length - 1;
          return (
            <li key={item.id} className="flex items-center">
              <button
                type="button"
                onClick={() => onSelect?.(item.id)}
                aria-label={`${idx + 1}. ${item.title}${isDone ? " – dokončeno" : ""}`}
                className={cn(
                  "group flex flex-col items-center gap-1.5 w-[104px] px-1 rounded-lg py-1.5 transition-colors",
                  onSelect && "hover:bg-accent/50 cursor-pointer",
                  !onSelect && "cursor-default"
                )}
              >
                <span
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold border-2 shrink-0 transition-colors",
                    isDone
                      ? "bg-primary text-primary-foreground border-primary"
                      : isNext
                        ? "bg-primary/10 text-primary border-primary border-dashed animate-pulse"
                        : "bg-muted text-muted-foreground border-border"
                  )}
                >
                  {isDone ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                </span>
                <span
                  className={cn(
                    "text-[11px] leading-tight text-center line-clamp-2",
                    isDone ? "text-muted-foreground" : "font-medium"
                  )}
                  title={item.title}
                >
                  {item.title}
                </span>
                {item.groupLabel && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-full">
                    {item.groupLabel}
                  </span>
                )}
              </button>
              {!isLast && (
                <span
                  aria-hidden
                  className={cn(
                    "h-0.5 w-4 rounded-full -mt-6",
                    isDone ? "bg-primary" : "bg-border"
                  )}
                />
              )}
            </li>
          );
        })}
        <li className="flex items-center">
          <span
            aria-hidden
            className={cn(
              "h-0.5 w-4 rounded-full -mt-6",
              allDone ? "bg-primary" : "bg-border"
            )}
          />
          <div className="flex flex-col items-center gap-1.5 w-[104px] py-1.5">
            <span
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center border-2",
                allDone
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border"
              )}
            >
              <Flag className="w-5 h-5" />
            </span>
            <span className="text-[11px] leading-tight text-center font-medium">Cíl</span>
          </div>
        </li>
      </ol>
      </div>
      </div>
      </div>
      </div>
    </section>
  );
};

export default CoursePathMap;

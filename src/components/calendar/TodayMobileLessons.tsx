import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { CalendarEvent } from "@/lib/calendar-utils";
import { compactTimeRange, lessonPhaseLabel, subjectAbbreviation, subjectChipColor, type LessonPhase } from "@/lib/today-lesson-chip";

interface Props {
  lessons: CalendarEvent[];
  phaseOf: (ev: CalendarEvent) => LessonPhase;
  targetOf: (ev: CalendarEvent) => string | undefined;
  canChange: (ev: CalendarEvent) => boolean;
  onAction: (ev: CalendarEvent, mode: "move" | "cancel" | "revert") => void;
  onOpen: (target: string) => void;
  role: "student" | "teacher";
}

/** Kompaktní mobilní seznam dnešních hodin (accordion, max. jedna otevřená). */
const TodayMobileLessons = ({ lessons, phaseOf, targetOf, canChange, onAction, onOpen, role }: Props) => {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ul className="space-y-1 pb-2" data-testid="today-mobile-lessons">
      {lessons.map((ev) => {
        const phase = phaseOf(ev);
        const cancelled = ev.scheduleStatus === "cancelled";
        const abbr = subjectAbbreviation(ev.abbreviation, ev.title);
        const time = compactTimeRange(ev.start, ev.end);
        const place = [ev.className, ev.room].filter(Boolean).join(" · ");
        const label = phase === "current" && !cancelled ? lessonPhaseLabel(phase) : phase === "past" && !ev.scheduleStatus ? lessonPhaseLabel(phase) : null;
        const statusText = cancelled ? "zrušeno" : ev.scheduleStatus ? "přesunuto" : label;
        const open = openId === ev.id;
        const panelId = `today-lesson-panel-${ev.id}`;
        const target = targetOf(ev);
        const change = canChange(ev);
        return (
          <li key={ev.id} className="scroll-mb-40">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${abbr}, ${time}${ev.room ? `, učebna ${ev.room}` : ""}${statusText ? `, ${statusText}` : ""}`}
              onClick={(e) => {
                const next = open ? null : ev.id;
                setOpenId(next);
                if (next) requestAnimationFrame(() => (e.currentTarget as HTMLElement)?.parentElement?.scrollIntoView({ block: "nearest" }));
              }}
              className={`flex min-h-12 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                phase === "current" && !cancelled ? "bg-primary/10" : "hover:bg-muted"
              } ${phase === "past" ? "opacity-60" : ""}`}
            >
              <span className={`shrink-0 whitespace-nowrap text-xs tabular-nums text-muted-foreground ${cancelled ? "line-through" : ""}`}>{time}</span>
              <span
                className="flex h-8 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-md text-xs font-bold text-white"
                style={{ backgroundColor: subjectChipColor(ev.color, ev.title) }}
                aria-hidden="true"
              >
                {abbr}
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{place}</span>
              {statusText && (
                <span className={`shrink-0 text-xs ${phase === "current" && !cancelled ? "font-medium text-primary" : "text-muted-foreground"}`}>{statusText}</span>
              )}
              {open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
            </button>
            {open && (
              <div id={panelId} className="mx-1 mt-1 space-y-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
                <p className="font-semibold">{ev.title}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                  <dt className="text-muted-foreground">Čas</dt><dd className="tabular-nums">{time}</dd>
                  {ev.room && (<><dt className="text-muted-foreground">Místnost</dt><dd>{ev.room}</dd></>)}
                  {ev.className && (<><dt className="text-muted-foreground">Třída</dt><dd>{ev.className}</dd></>)}
                  {ev.scheduleStatus === "moved_from" && ev.movedStart && (<><dt className="text-muted-foreground">Přesunuto na</dt><dd>{format(ev.movedStart, "d. M.")} {compactTimeRange(ev.movedStart, ev.movedStart).split("–")[0]}</dd></>)}
                  {role === "student" && cancelled && ev.publicReason && (<><dt className="text-muted-foreground">Důvod</dt><dd>{ev.publicReason}</dd></>)}
                </dl>
                {change && (
                  <div className="flex gap-2">
                    {ev.scheduleStatus ? (
                      <Button variant="outline" className="h-11 flex-1" onClick={() => onAction(ev, "revert")}>Vrátit zpět</Button>
                    ) : (
                      <>
                        <Button variant="outline" className="h-11 flex-1" onClick={() => onAction(ev, "move")}>Přesunout</Button>
                        <Button variant="outline" className="h-11 flex-1" onClick={() => onAction(ev, "cancel")}>Zrušit</Button>
                      </>
                    )}
                  </div>
                )}
                {target && (
                  <Button variant="ghost" className="h-11 w-full" onClick={() => onOpen(target)}>Otevřít výuku</Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default TodayMobileLessons;

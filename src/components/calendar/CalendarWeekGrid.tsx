import { addDays, isSameDay, isToday, format } from "date-fns";
import { cs } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  type CalendarEvent,
  formatTime,
  getEventColors,
} from "@/lib/calendar-utils";
import { getExamTypeMeta } from "@/lib/exam-types";

interface Props {
  events: CalendarEvent[];
  weekStart: Date;
  viewMode: "week" | "day";
  selectedDay?: Date;
  onEventClick?: (event: CalendarEvent) => void;
  /** Map of event.id → reflection state for past lessons. */
  reflectionState?: Record<string, "missing" | "present">;
  onReflectionClick?: (event: CalendarEvent) => void;
}

const HOUR_START = 7;
const HOUR_END = 19; // exclusive → 12 rows (7..18)
const ROW_HEIGHT = 60;
const TOTAL_HEIGHT = (HOUR_END - HOUR_START) * ROW_HEIGHT;

const capitalize = (s: string) =>
  s.length ? s[0].toUpperCase() + s.slice(1) : s;

const CalendarWeekGrid = ({
  events,
  weekStart,
  viewMode,
  selectedDay,
  onEventClick,
  reflectionState,
  onReflectionClick,
}: Props) => {
  const isMobile = useIsMobile();

  let days: Date[];
  if (viewMode === "day") {
    days = [selectedDay ?? new Date()];
  } else {
    const count = isMobile ? 5 : 7;
    days = Array.from({ length: count }, (_, i) => addDays(weekStart, i));
  }

  const gridCols =
    viewMode === "day"
      ? "60px 1fr"
      : isMobile
      ? "60px repeat(5, 1fr)"
      : "60px repeat(7, 1fr)";

  const hours = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card">
      {/* Header */}
      <div
        className="grid border-b border-border bg-muted/30"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div />
        {days.map((d) => {
          const today = isToday(d);
          return (
            <div
              key={d.toISOString()}
              className={cn(
                "px-2 py-3 text-center border-l border-border",
                today && "bg-primary/10 font-medium",
              )}
            >
              <div className="text-xs text-muted-foreground">
                {capitalize(format(d, "EEEEEE", { locale: cs }))}
              </div>
              <div className="text-sm font-medium">{format(d, "d.M.")}</div>
            </div>
          );
        })}
      </div>

      {/* Body */}
      <div
        className="grid relative"
        style={{ gridTemplateColumns: gridCols, height: `${TOTAL_HEIGHT}px` }}
      >
        {/* Hours column */}
        <div className="relative">
          {hours.map((h, i) => (
            <div
              key={h}
              className="absolute left-0 right-0 px-2 text-[11px] text-muted-foreground border-t border-border"
              style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
            >
              {h}:00
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((d) => {
          const dayEvents = events.filter((e) => isSameDay(e.start, d));
          return (
            <div
              key={d.toISOString()}
              className="relative border-l border-border"
            >
              {/* Hour grid lines */}
              {hours.map((_, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-t border-border/60"
                  style={{ top: `${i * ROW_HEIGHT}px`, height: `${ROW_HEIGHT}px` }}
                />
              ))}

              {/* Events */}
              {dayEvents.map((ev) => {
                const startMin =
                  (ev.start.getHours() - HOUR_START) * 60 +
                  ev.start.getMinutes();
                const durMin = Math.max(
                  20,
                  (ev.end.getTime() - ev.start.getTime()) / 60000,
                );
                if (
                  startMin < 0 ||
                  startMin > (HOUR_END - HOUR_START) * 60
                )
                  return null;
                const defaults = getEventColors(ev.type);
                const customColor = ev.color;
                const bg = customColor ? `${customColor}26` : defaults.bg;
                const border = customColor || defaults.border;

                const reflectionStatus = reflectionState?.[ev.id];
                const showReflectionBadge =
                  ev.type === "lesson" && !!reflectionStatus;
                return (
                  <div
                    key={ev.id}
                    className="absolute"
                    style={{
                      top: `${startMin}px`,
                      height: `${durMin}px`,
                      left: "4px",
                      right: "4px",
                    }}
                  >
                    <button
                      onClick={() => onEventClick?.(ev)}
                      className="w-full h-full rounded-md text-left px-2 py-1 overflow-hidden border-l-4 border text-xs hover:opacity-90 transition-opacity"
                      style={{
                        backgroundColor: bg,
                        borderColor: border,
                        borderLeftColor: border,
                        color: defaults.text,
                      }}
                      title={ev.title}
                    >
                      <div className="leading-tight flex items-center gap-1 pr-4">
                        {ev.abbreviation ? (
                          <span
                            className="inline-block text-[10px] font-bold text-white px-1.5 py-0.5 rounded shrink-0"
                            style={{ backgroundColor: customColor || defaults.border }}
                          >
                            {ev.abbreviation}
                          </span>
                        ) : (
                          <span className="font-medium truncate">{ev.title}</span>
                        )}
                        {ev.weekParity === "odd" && (
                          <span className="text-[9px] font-semibold px-1 rounded bg-background/60 border border-border shrink-0">L</span>
                        )}
                        {ev.weekParity === "even" && (
                          <span className="text-[9px] font-semibold px-1 rounded bg-background/60 border border-border shrink-0">S</span>
                        )}
                      </div>
                      <div className="text-[10px] opacity-80 truncate mt-0.5">
                        {formatTime(ev.start)}
                        {ev.className ? ` · ${ev.className}` : ""}
                        {ev.room ? ` · ${ev.room}` : ""}
                      </div>
                    </button>
                    {showReflectionBadge && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReflectionClick?.(ev);
                        }}
                        className={cn(
                          "absolute top-1 right-1 w-4 h-4 rounded-full border-2 border-background shadow-sm flex items-center justify-center text-[9px] font-bold text-white",
                          reflectionStatus === "missing"
                            ? "bg-red-500 hover:bg-red-600 animate-pulse"
                            : "bg-emerald-500 hover:bg-emerald-600",
                        )}
                        aria-label={
                          reflectionStatus === "missing"
                            ? "Přidat reflexi hodiny"
                            : "Upravit reflexi hodiny"
                        }
                        title={
                          reflectionStatus === "missing"
                            ? "Přidat reflexi hodiny"
                            : "Reflexe uložena"
                        }
                      >
                        {reflectionStatus === "present" ? "✓" : "!"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarWeekGrid;

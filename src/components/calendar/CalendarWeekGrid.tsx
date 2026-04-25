import { addDays, isSameDay, isToday, format } from "date-fns";
import { cs } from "date-fns/locale";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import {
  type CalendarEvent,
  formatTime,
  getEventColors,
} from "@/lib/calendar-utils";

interface Props {
  events: CalendarEvent[];
  weekStart: Date;
  viewMode: "week" | "day";
  selectedDay?: Date;
  onEventClick?: (event: CalendarEvent) => void;
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
                const colors = getEventColors(ev.type);

                return (
                  <button
                    key={ev.id}
                    onClick={() => onEventClick?.(ev)}
                    className="absolute rounded-md text-left px-2 py-1 overflow-hidden border text-xs hover:opacity-90 transition-opacity"
                    style={{
                      top: `${startMin}px`,
                      height: `${durMin}px`,
                      left: "4px",
                      right: "4px",
                      backgroundColor: colors.bg,
                      borderColor: colors.border,
                      color: colors.text,
                    }}
                    title={ev.title}
                  >
                    <div className="font-medium leading-tight truncate">
                      {formatTime(ev.start)} {ev.title}
                    </div>
                    {ev.room && (
                      <div className="text-[10px] opacity-80 truncate">
                        {ev.room}
                      </div>
                    )}
                  </button>
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

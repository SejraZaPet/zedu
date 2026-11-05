import { cn } from "@/lib/utils";
import { type CalendarEvent, formatTime, getEventColors } from "@/lib/calendar-utils";
import { splitDayAgenda } from "@/lib/calendar-day-agenda";
import DeadlineMarker from "@/components/calendar/DeadlineMarker";

interface Props {
  events: CalendarEvent[];
  day: Date;
  onEventClick?: (event: CalendarEvent) => void;
  reflectionState?: Record<string, "missing" | "present">;
  onReflectionClick?: (event: CalendarEvent) => void;
}

/** Mobile day view: readable list instead of the absolute time grid. */
const CalendarDayAgenda = ({ events, day, onEventClick, reflectionState, onReflectionClick }: Props) => {
  const { lessons, deadlines } = splitDayAgenda(events, day);

  const card = (ev: CalendarEvent, showRange: boolean) => {
    const c = getEventColors(ev.type);
    const border = ev.color || c.border;
    const refl = ev.type === "lesson" ? reflectionState?.[ev.id] : undefined;
    return (
      <li key={ev.id} className="flex items-stretch gap-2">
        <button
          type="button"
          onClick={() => onEventClick?.(ev)}
          className={cn(
            "min-h-[44px] flex-1 rounded-md border border-l-4 px-3 py-2 text-left text-sm",
            ev.scheduleStatus === "cancelled" && "opacity-70",
          )}
          style={{ backgroundColor: ev.color ? `${ev.color}26` : c.bg, borderColor: border, borderLeftColor: border, color: c.text }}
        >
          <div className="text-xs font-semibold">
            {formatTime(ev.start)}{showRange ? `–${formatTime(ev.end)}` : ""}
            {ev.className ? ` · ${ev.className}` : ""}{ev.room ? ` · ${ev.room}` : ""}
          </div>
          <div className={cn("font-medium break-words", ev.scheduleStatus === "cancelled" && "line-through")}>{ev.title}</div>
          {ev.scheduleStatus === "cancelled" && (
            <div className="text-xs font-semibold">Zrušeno{ev.publicReason ? ` · ${ev.publicReason}` : ""}</div>
          )}
          {ev.scheduleStatus === "moved_from" && ev.movedStart && (
            <div className="text-xs font-semibold">Přesunuto na {ev.movedStart.getDate()}. {ev.movedStart.getMonth() + 1}. {formatTime(ev.movedStart)}</div>
          )}
          {ev.scheduleStatus === "moved_to" && <div className="text-xs font-semibold">Přesunuto</div>}
        </button>
        {refl && (
          <button
            type="button"
            onClick={() => onReflectionClick?.(ev)}
            className="min-h-[44px] min-w-[44px] rounded-md border text-xs font-semibold"
            aria-label={refl === "missing" ? "Přidat reflexi hodiny" : "Upravit reflexi hodiny"}
          >
            {refl === "present" ? "✓" : "!"}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-5 rounded-lg border bg-card p-3" data-testid="calendar-day-agenda">
      {deadlines.length > 0 && (
        <div className="flex items-center gap-2 border-b pb-2">
          <span className="text-sm font-semibold">Termíny</span>
          <DeadlineMarker events={deadlines} onOpen={onEventClick} />
        </div>
      )}
      <section>
        <h2 className="mb-2 text-sm font-semibold">Rozvrh</h2>
        {lessons.length ? <ul className="space-y-2">{lessons.map((e) => card(e, true))}</ul>
          : <p className="text-sm text-muted-foreground">Žádné hodiny.</p>}
      </section>
    </div>
  );
};

export default CalendarDayAgenda;

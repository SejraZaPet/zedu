import { AlertCircle, Flag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type CalendarEvent, formatTime } from "@/lib/calendar-utils";
import { deadlineTone, groupTone, TONE_LABEL, type DeadlineTone } from "@/lib/calendar-deadlines";

const TONE_CLASS: Record<DeadlineTone, string> = {
  overdue: "bg-destructive text-destructive-foreground",
  soon: "bg-warning text-warning-foreground",
  later: "bg-muted text-muted-foreground border border-border",
};

interface Props { events: CalendarEvent[]; onOpen?: (e: CalendarEvent) => void }

/** One round marker per day; tap shows the list with "Otevřít". */
const DeadlineMarker = ({ events, onOpen }: Props) => {
  if (!events.length) return null;
  const tone = groupTone(events);
  const Icon = tone === "later" ? Flag : AlertCircle;
  const label = `${events.length === 1 ? "Termín úkolu" : `Termíny úkolů: ${events.length}`} – ${TONE_LABEL[tone]}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="inline-flex h-11 min-w-11 items-center justify-center"
          data-testid="deadline-marker"
        >
          <span className={cn("inline-flex h-7 min-w-7 items-center justify-center gap-0.5 rounded-full px-1.5 text-xs font-bold", TONE_CLASS[tone])}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {events.length > 1 && <span>{events.length}</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <ul className="space-y-2">
          {events.map((ev) => {
            const t = deadlineTone(ev.start);
            return (
              <li key={ev.id} className="rounded-md border p-2">
                <div className="text-sm font-medium break-words">{ev.title}</div>
                <div className="text-xs text-muted-foreground">
                  Termín {formatTime(ev.start)} · {TONE_LABEL[t]}
                </div>
                <Button size="sm" className="mt-2 min-h-11 w-full" onClick={() => onOpen?.(ev)}>Otevřít</Button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
};

export default DeadlineMarker;

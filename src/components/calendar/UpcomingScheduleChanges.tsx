import { useEffect, useState } from "react";
import { addDays, endOfDay, format, startOfDay } from "date-fns";
import { cs } from "date-fns/locale";
import { CalendarX2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { expandScheduleSlots, formatTime, type CalendarEvent } from "@/lib/calendar-utils";
import { fetchStudentScheduleChanges, mergeStudentScheduleChanges } from "@/lib/schedule-exception-store";

/**
 * Read-only list of visible one-off changes (cancelled / moved) for the given
 * recurring slots over the next `days` days. Renders nothing when there are no
 * changes or the safe RPC fails, so the timetable looks exactly as before.
 */
export default function UpcomingScheduleChanges({ slots, days = 14, compact = false }: {
  slots: any[];
  days?: number;
  compact?: boolean;
}) {
  const [changes, setChanges] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!slots.length) { setChanges([]); return; }
    let off = false;
    const from = startOfDay(new Date());
    const to = endOfDay(addDays(from, days));
    fetchStudentScheduleChanges(from, to).then((rows) => {
      if (off) return;
      if (!rows.length) { setChanges([]); return; }
      const expand = (f: Date, t: Date) => expandScheduleSlots(slots as any, f, t);
      const merged = mergeStudentScheduleChanges(expand(from, to), rows, { from, to }, expand);
      setChanges(merged.filter((e) => e.scheduleStatus === "cancelled" || e.scheduleStatus === "moved_to"));
    });
    return () => { off = true; };
  }, [slots, days]);

  if (!changes.length) return null;
  return (
    <section aria-label="Změny v rozvrhu" className={`bg-card border border-border rounded-xl ${compact ? "p-2 mb-2" : "p-4 mb-4"}`}>
      <h2 className={`font-medium flex items-center gap-2 ${compact ? "text-xs mb-1" : "text-sm mb-2"}`}>
        <CalendarX2 className="w-4 h-4 text-primary" aria-hidden /> Změny v rozvrhu
      </h2>
      <ul className="space-y-1.5">
        {changes.map((e) => {
          const cancelled = e.scheduleStatus === "cancelled";
          return (
            <li key={e.id} className={compact ? "text-xs" : "text-sm"}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`tabular-nums text-muted-foreground ${cancelled ? "line-through" : ""}`}>
                  {format(e.start, "EEE d. M.", { locale: cs })} {formatTime(e.start)}–{formatTime(e.end)}
                </span>
                <span className={`font-medium ${cancelled ? "line-through" : ""}`}>{e.title}</span>
                <Badge variant="outline">{cancelled ? "Zrušeno" : "Přesunuto"}</Badge>
              </div>
              {cancelled && e.publicReason && (
                <div className="text-xs text-muted-foreground">Důvod: {e.publicReason}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

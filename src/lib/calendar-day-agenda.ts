import { isSameDay } from "date-fns";
import type { CalendarEvent } from "@/lib/calendar-utils";

/** Splits one day's events into timetable lessons and deadlines, each sorted by start. Nothing is dropped by hour. */
export function splitDayAgenda(events: CalendarEvent[], day: Date) {
  const sameDay = events
    .filter((e) => isSameDay(e.start, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  return {
    lessons: sameDay.filter((e) => e.type === "lesson"),
    deadlines: sameDay.filter((e) => e.type !== "lesson"),
  };
}

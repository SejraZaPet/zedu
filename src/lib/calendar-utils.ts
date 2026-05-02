import {
  eachDayOfInterval,
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
} from "date-fns";

export type CalendarEvent = {
  id: string;
  type: "lesson" | "assignment" | "todo";
  title: string;
  start: Date;
  end: Date;
  classId?: string;
  className?: string;
  room?: string;
  subject?: string;
  assignmentId?: string;
  todoId?: string;
  priority?: "low" | "normal" | "high";
  color?: string;
  abbreviation?: string;
};

export type ScheduleSlotInput = {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  week_parity: "every" | "odd" | "even";
  valid_from: string | null;
  valid_to: string | null;
  subject_label: string;
  room: string;
  classes?: { name: string } | null;
};

const parseTime = (date: Date, time: string): Date => {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

export function expandScheduleSlots(
  slots: ScheduleSlotInput[],
  fromDate: Date,
  toDate: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const days = eachDayOfInterval({ start: fromDate, end: toDate });

  for (const date of days) {
    const jsDay = date.getDay();
    const dow = jsDay === 0 ? 7 : jsDay;
    const isoWeek = getISOWeek(date);
    const isOdd = isoWeek % 2 === 1;

    for (const slot of slots) {
      if (slot.day_of_week !== dow) continue;

      if (slot.valid_from) {
        const vf = new Date(slot.valid_from);
        vf.setHours(0, 0, 0, 0);
        const d0 = new Date(date);
        d0.setHours(0, 0, 0, 0);
        if (d0 < vf) continue;
      }
      if (slot.valid_to) {
        const vt = new Date(slot.valid_to);
        vt.setHours(23, 59, 59, 999);
        if (date > vt) continue;
      }

      if (slot.week_parity === "odd" && !isOdd) continue;
      if (slot.week_parity === "even" && isOdd) continue;

      const start = parseTime(date, slot.start_time);
      const end = parseTime(date, slot.end_time);
      const className = slot.classes?.name ?? "";
      const title = slot.subject_label?.trim() || className || "Hodina";

      events.push({
        id: `${slot.id}-${date.toISOString().slice(0, 10)}`,
        type: "lesson",
        title,
        start,
        end,
        classId: slot.class_id,
        className,
        room: slot.room || undefined,
        subject: slot.subject_label || undefined,
      });
    }
  }

  return events;
}

export function getWeekRange(date: Date): { start: Date; end: Date } {
  return { start: startOfISOWeek(date), end: endOfISOWeek(date) };
}

export function formatTime(d: Date): string {
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function getEventColors(type: CalendarEvent["type"]) {
  if (type === "lesson")
    return { bg: "#dbeafe", border: "#93c5fd", text: "#1e3a8a" };
  if (type === "assignment")
    return { bg: "#fed7aa", border: "#fb923c", text: "#7c2d12" };
  return { bg: "#bbf7d0", border: "#4ade80", text: "#14532d" };
}

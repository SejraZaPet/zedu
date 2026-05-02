// Local persistence for the teacher's personal schedule (used by TeacherSchedule + TeacherCalendar)
import { eachDayOfInterval, getISOWeek } from "date-fns";
import type { CalendarEvent } from "./calendar-utils";

export interface LessonEntry {
  id: string;
  day: number; // 0=Mon … 4=Fri
  period: number;
  subject: string;
  abbreviation?: string; // short code shown in cell, e.g. "MAT"
  color?: string; // hex color, e.g. "#6EC6D9"
  className: string;
  room: string;
  /** When true (only meaningful in odd/even mode), this lesson is mirrored
   *  into both odd & even week lists, sharing the same `mirrorKey`. */
  mirrorBoth?: boolean;
  /** Stable key linking the two mirrored copies across odd & even lists. */
  mirrorKey?: string;
}

/** Predefined palette for subject color picker. */
export const SUBJECT_COLORS: { value: string; label: string }[] = [
  { value: "#6EC6D9", label: "Tyrkysová" },
  { value: "#9B6CFF", label: "Fialová" },
  { value: "#F472B6", label: "Růžová" },
  { value: "#F87171", label: "Červená" },
  { value: "#FB923C", label: "Oranžová" },
  { value: "#FBBF24", label: "Žlutá" },
  { value: "#34D399", label: "Zelená" },
  { value: "#60A5FA", label: "Modrá" },
  { value: "#A3A3A3", label: "Šedá" },
];

/** Stable color for an unspecified subject (deterministic by name). */
export function colorForSubject(subject: string): string {
  if (!subject) return SUBJECT_COLORS[0].value;
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length].value;
}

/** Build a map subject → { color, abbreviation } across all lesson lists.
 *  Same subject keeps the same visual identity everywhere. First occurrence wins. */
export function buildSubjectStyleMap(data: TeacherScheduleData): Map<string, { color: string; abbreviation: string }> {
  const map = new Map<string, { color: string; abbreviation: string }>();
  const all = [...data.lessonsBoth, ...data.lessonsOdd, ...data.lessonsEven];
  for (const l of all) {
    const key = l.subject.trim();
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, {
        color: l.color || colorForSubject(key),
        abbreviation: l.abbreviation?.trim() || key.slice(0, 3).toUpperCase(),
      });
    }
  }
  return map;
}

export interface PeriodTime {
  start: string;
  end: string;
}

export interface RowBreak {
  afterPeriod: number;
  durationMin: number;
  notes: Record<number, string>;
}

export type WeekParityMode = "both" | "odd" | "even";

export interface TeacherScheduleData {
  periods: number[]; // ordered list of period numbers (e.g. [1,2,3,…])
  periodTimes: Record<number, PeriodTime>;
  breaks: RowBreak[];
  lessonsBoth: LessonEntry[];
  lessonsOdd: LessonEntry[];
  lessonsEven: LessonEntry[];
  parityMode: WeekParityMode;
}

export const DEFAULT_PERIOD_TIMES: Record<number, PeriodTime> = {
  1: { start: "08:00", end: "08:45" },
  2: { start: "08:55", end: "09:40" },
  3: { start: "09:50", end: "10:35" },
  4: { start: "10:55", end: "11:40" },
  5: { start: "11:50", end: "12:35" },
  6: { start: "12:45", end: "13:30" },
  7: { start: "13:40", end: "14:25" },
  8: { start: "14:35", end: "15:20" },
};

export const DEFAULT_SCHEDULE: TeacherScheduleData = {
  periods: [1, 2, 3, 4, 5, 6, 7, 8],
  periodTimes: DEFAULT_PERIOD_TIMES,
  breaks: [{ afterPeriod: 3, durationMin: 20, notes: {} }],
  lessonsBoth: [],
  lessonsOdd: [],
  lessonsEven: [],
  parityMode: "both",
};

const STORAGE_KEY = "teacher_schedule_v1";

export function loadSchedule(): TeacherScheduleData {
  if (typeof window === "undefined") return DEFAULT_SCHEDULE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SCHEDULE;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SCHEDULE,
      ...parsed,
      periodTimes: { ...DEFAULT_PERIOD_TIMES, ...(parsed.periodTimes ?? {}) },
    };
  } catch {
    return DEFAULT_SCHEDULE;
  }
}

export function saveSchedule(data: TeacherScheduleData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

const parseTime = (date: Date, time: string): Date => {
  const [h, m] = time.split(":").map((x) => parseInt(x, 10));
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

export function expandTeacherSchedule(
  schedule: TeacherScheduleData,
  fromDate: Date,
  toDate: Date,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const days = eachDayOfInterval({ start: fromDate, end: toDate });

  const styleMap = buildSubjectStyleMap(schedule);

  for (const date of days) {
    const jsDay = date.getDay();
    if (jsDay === 0 || jsDay === 6) continue; // skip weekends
    const dayIdx = jsDay - 1; // 0=Mon..4=Fri
    const isOdd = getISOWeek(date) % 2 === 1;

    let pool: LessonEntry[] = [];
    if (schedule.parityMode === "both") {
      pool = schedule.lessonsBoth;
    } else if (schedule.parityMode === "odd") {
      pool = isOdd ? schedule.lessonsOdd : schedule.lessonsEven;
    } else {
      // "even" mode label = different schedules; we use lessonsOdd for odd weeks, lessonsEven for even weeks
      pool = isOdd ? schedule.lessonsOdd : schedule.lessonsEven;
    }

    for (const l of pool) {
      if (l.day !== dayIdx) continue;
      const t = schedule.periodTimes[l.period];
      if (!t) continue;
      const start = parseTime(date, t.start);
      const end = parseTime(date, t.end);
      const style = styleMap.get(l.subject.trim());
      events.push({
        id: `personal-${l.id}-${date.toISOString().slice(0, 10)}`,
        type: "lesson",
        title: l.subject || l.className || "Hodina",
        start,
        end,
        className: l.className || undefined,
        room: l.room || undefined,
        subject: l.subject || undefined,
        color: l.color || style?.color,
        abbreviation: l.abbreviation || style?.abbreviation,
      });
    }
  }
  return events;
}

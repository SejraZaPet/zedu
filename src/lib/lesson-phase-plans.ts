/**
 * Lightweight local persistence for "phase schedules" of a teacher's lesson plan.
 * Keyed by subject + date + start time so the calendar/schedule dialog can
 * surface the timetable for a clicked lesson.
 */
export interface PhaseEntry {
  key: string;
  title: string;
  timeMin: number;
}

export interface StoredPhasePlan {
  subject: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:mm
  end?: string;
  title?: string;
  phases: PhaseEntry[];
  updatedAt: string;
}

const KEY = "zedu.phase-plans.v1";

function readAll(): Record<string, StoredPhasePlan> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAll(map: Record<string, StoredPhasePlan>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
}

export function planKey(subject: string, date: string, start: string) {
  return `${(subject || "").trim().toLowerCase()}|${date}|${start}`;
}

export function savePhasePlan(plan: StoredPhasePlan) {
  const map = readAll();
  map[planKey(plan.subject, plan.date, plan.start)] = {
    ...plan,
    updatedAt: new Date().toISOString(),
  };
  writeAll(map);
}

export function getPhasePlan(
  subject: string | undefined,
  date: string | undefined,
  start: string | undefined,
): StoredPhasePlan | null {
  if (!subject || !date || !start) return null;
  const map = readAll();
  return map[planKey(subject, date, start)] || null;
}

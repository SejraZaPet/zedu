import { isSameDay } from "date-fns";
import type { CalendarEvent } from "@/lib/calendar-utils";
import { assignmentKind } from "@/lib/assignment-kind";

export type DeadlineTone = "overdue" | "soon" | "later";

/** Red = past, orange = within 24 h, grey = later. */
export function deadlineTone(deadline: Date, now: Date = new Date()): DeadlineTone {
  const diff = deadline.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= 24 * 3600 * 1000) return "soon";
  return "later";
}

export const TONE_LABEL: Record<DeadlineTone, string> = { overdue: "Po termínu", soon: "Do 24 hodin", later: "Později" };

/** Only tasks (no material/announcement); for students also drop already submitted ones. */
export function filterCalendarAssignments<T extends { id: string; settings?: unknown }>(
  rows: T[],
  submittedIds?: Set<string>,
): T[] {
  return rows.filter((r) => assignmentKind(r.settings) === "task" && !(submittedIds?.has(r.id)));
}

export function deadlinesForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => e.type === "assignment" && isSameDay(e.start, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Worst tone of a group decides the marker colour. */
export function groupTone(events: CalendarEvent[], now: Date = new Date()): DeadlineTone {
  const tones = events.map((e) => deadlineTone(e.start, now));
  return tones.includes("overdue") ? "overdue" : tones.includes("soon") ? "soon" : "later";
}

/** Assigns overlapping timed events to side-by-side columns. */
export function layoutOverlaps(events: { id: string; start: Date; end: Date }[]): Record<string, { col: number; cols: number }> {
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime() || b.end.getTime() - a.end.getTime());
  const out: Record<string, { col: number; cols: number }> = {};
  let cluster: typeof sorted = [];
  let colEnds: number[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    for (const e of cluster) out[e.id].cols = colEnds.length;
    cluster = []; colEnds = [];
  };
  for (const e of sorted) {
    const s = e.start.getTime();
    if (s >= clusterEnd) { flush(); clusterEnd = -Infinity; }
    let col = colEnds.findIndex((end) => end <= s);
    if (col === -1) { col = colEnds.length; colEnds.push(0); }
    colEnds[col] = e.end.getTime();
    out[e.id] = { col, cols: 1 };
    cluster.push(e);
    clusterEnd = Math.max(clusterEnd, e.end.getTime());
  }
  flush();
  return out;
}

const KEY = "bezli.calendar.showDeadlines";
export function loadShowDeadlines(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function saveShowDeadlines(v: boolean) {
  try { localStorage.setItem(KEY, v ? "1" : "0"); } catch { /* private mode */ }
}

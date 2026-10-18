import type { CalendarEvent } from "./calendar-utils";

/** Stable source identity, independent of display IDs and destination dates. */
export interface ScheduleOccurrenceSource {
  kind: "class_slot" | "personal";
  ownerId: string;
  slotId: string;
  originalDate: string;
}

/** Public projection only: private notes and permissions belong on the server. */
export interface ScheduleException {
  id: string;
  source: ScheduleOccurrenceSource;
  action: "cancelled" | "moved";
  state: "active" | "reverted";
  newDate?: string;
  newStart?: string;
  newEnd?: string;
  publicReason?: string;
}

export type ScheduleOccurrence = CalendarEvent & { source: ScheduleOccurrenceSource };
export type EffectiveScheduleOccurrence = ScheduleOccurrence & {
  scheduleStatus?: "cancelled" | "moved_from" | "moved_to";
  exceptionId?: string;
  publicReason?: string;
  isTeachingOccurrence: boolean;
  originalStart?: Date;
  movedStart?: Date;
};

export function scheduleOccurrenceKey(source: ScheduleOccurrenceSource): string {
  return JSON.stringify([source.kind, source.ownerId, source.slotId, source.originalDate]);
}

const pragueFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Prague", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});

function pragueParts(date: Date): Record<string, number> {
  return Object.fromEntries(pragueFormatter.formatToParts(date)
    .filter((part) => part.type !== "literal")
    .map((part) => [part.type, Number(part.value)]));
}

export function pragueCalendarDate(date: Date): string {
  const p = pragueParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Resolve Prague wall time even for a viewer abroad; reject DST gaps and folds. */
export function resolvePragueTime(date: string, time: string): Date {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::00)?$/.exec(time);
  if (!dateMatch || !timeMatch) throw new Error("Neplatné datum nebo čas.");
  const [year, month, day] = dateMatch.slice(1).map(Number);
  const [hour, minute] = timeMatch.slice(1).map(Number);
  const naive = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (year < 100 || naive.getUTCFullYear() !== year || naive.getUTCMonth() !== month - 1 ||
      naive.getUTCDate() !== day || hour > 23 || minute > 59) {
    throw new Error("Neplatné datum nebo čas.");
  }
  const offsets = new Set<number>();
  for (const hours of [-36, 0, 36]) {
    const sample = new Date(naive.getTime() + hours * 3600000);
    const p = pragueParts(sample);
    offsets.add(Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - sample.getTime());
  }
  const candidates = [...offsets].map((offset) => new Date(naive.getTime() - offset))
    .filter((candidate) => {
      const p = pragueParts(candidate);
      return p.year === year && p.month === month && p.day === day && p.hour === hour && p.minute === minute;
    });
  if (!candidates.length) throw new Error("Tento čas při přechodu na letní čas neexistuje.");
  if (candidates.length > 1) throw new Error("Tento čas při přechodu na zimní čas není jednoznačný.");
  const result = candidates[0];
  if (!result) throw new Error("Neplatný čas.");
  return result;
}

function moveTimes(exception: ScheduleException): { start: Date; end: Date } {
  if (!exception.newDate || !exception.newStart || !exception.newEnd) {
    throw new Error("Přesun vyžaduje datum, začátek a konec.");
  }
  const start = resolvePragueTime(exception.newDate, exception.newStart);
  const end = resolvePragueTime(exception.newDate, exception.newEnd);
  if (end <= start) throw new Error("Konec hodiny musí být po začátku.");
  return { start, end };
}

/**
 * Pure projection, not authorization/persistence. Callers supply authorized
 * sources, including original occurrences moved into the requested range.
 */
export function applyScheduleExceptions(
  occurrences: readonly ScheduleOccurrence[],
  exceptions: readonly ScheduleException[],
  range: { start: Date; end: Date },
): EffectiveScheduleOccurrence[] {
  if (!Number.isFinite(range.start.getTime()) || !Number.isFinite(range.end.getTime()) || range.end < range.start) {
    throw new Error("Neplatný rozsah kalendáře.");
  }
  const active = new Map<string, ScheduleException>();
  for (const exception of exceptions) {
    if (exception.state !== "active") continue;
    const key = scheduleOccurrenceKey(exception.source);
    if (active.has(key)) throw new Error("Pro hodinu a datum smí existovat jen jedna aktivní výjimka.");
    if (exception.action === "moved") moveTimes(exception);
    active.set(key, exception);
  }
  const result: EffectiveScheduleOccurrence[] = [];
  const append = (event: EffectiveScheduleOccurrence) => {
    if (event.start <= range.end && event.end > range.start) result.push(event);
  };
  for (const occurrence of occurrences) {
    const exception = active.get(scheduleOccurrenceKey(occurrence.source));
    if (!exception) {
      append({ ...occurrence, isTeachingOccurrence: true });
      continue;
    }
    const shared = { exceptionId: exception.id, publicReason: exception.publicReason };
    if (exception.action === "cancelled") {
      append({ ...occurrence, ...shared, scheduleStatus: "cancelled", isTeachingOccurrence: false });
      continue;
    }
    const { start, end } = moveTimes(exception);
    append({ ...occurrence, ...shared, scheduleStatus: "moved_from", movedStart: start, isTeachingOccurrence: false });
    append({ ...occurrence, ...shared, id: `${occurrence.id}:moved:${exception.id}`, start, end,
      scheduleStatus: "moved_to", originalStart: occurrence.start, isTeachingOccurrence: true });
  }
  return result.sort((a, b) => a.start.getTime() - b.start.getTime() || a.id.localeCompare(b.id));
}

export function effectivePlanOccurrence(
  source: ScheduleOccurrenceSource,
  events: readonly EffectiveScheduleOccurrence[],
): EffectiveScheduleOccurrence | null {
  const key = scheduleOccurrenceKey(source);
  const matches = events.filter((event) => event.isTeachingOccurrence && scheduleOccurrenceKey(event.source) === key);
  return matches.length === 1 ? matches[0] ?? null : null;
}

export function scheduleTimeConflicts(
  candidate: Pick<CalendarEvent, "start" | "end">,
  events: readonly EffectiveScheduleOccurrence[],
  excludeSource?: ScheduleOccurrenceSource,
): EffectiveScheduleOccurrence[] {
  const excluded = excludeSource ? scheduleOccurrenceKey(excludeSource) : undefined;
  return events.filter((event) => event.isTeachingOccurrence &&
    (!excluded || scheduleOccurrenceKey(event.source) !== excluded) &&
    candidate.start < event.end && candidate.end > event.start);
}
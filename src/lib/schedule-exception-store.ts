import { addDays, format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { CalendarEvent } from "./calendar-utils";
import {
  applyScheduleExceptions,
  type ScheduleException,
  type ScheduleOccurrence,
  type ScheduleOccurrenceSource,
} from "./schedule-exceptions";

/**
 * Teacher-only, one-off timetable exceptions (stage 1). Exceptions are merged
 * at display time; the recurring timetable is never copied or rewritten.
 */
export type ExceptionRow = {
  id: string;
  owner_id: string;
  source_kind: string;
  source_id: string;
  original_date: string;
  action: string;
  state: string;
  new_date: string | null;
  new_start: string | null;
  new_end: string | null;
  public_reason: string;
  revision: number;
};

export type Expander = (from: Date, to: Date) => CalendarEvent[];

const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : undefined);

/** Only sources the signed-in teacher owns may carry exceptions. */
export function ownedSource(event: CalendarEvent, userId: string): ScheduleOccurrenceSource | null {
  const s = event.scheduleSource;
  if (event.type !== "lesson" || !s) return null;
  if (s.kind === "class_slot" && s.createdBy !== userId) return null;
  return { kind: s.kind, ownerId: userId, slotId: s.slotId, originalDate: format(event.originalStart ?? event.start, "yyyy-MM-dd") };
}

export function rowToException(row: ExceptionRow): ScheduleException {
  return {
    id: row.id,
    source: {
      kind: row.source_kind as ScheduleOccurrenceSource["kind"],
      ownerId: row.owner_id,
      slotId: row.source_id,
      originalDate: row.original_date,
    },
    action: row.action as ScheduleException["action"],
    state: row.state === "active" ? "active" : "reverted",
    newDate: row.new_date ?? undefined,
    newStart: hhmm(row.new_start),
    newEnd: hhmm(row.new_end),
    publicReason: row.public_reason || undefined,
  };
}

/**
 * Merge exceptions into expanded lessons. Originals of lessons moved into the
 * range from outside it are expanded on demand. Never throws: on bad data the
 * plain timetable is returned unchanged.
 */
export function mergeExceptions(
  events: CalendarEvent[],
  rows: ExceptionRow[],
  userId: string,
  range: { from: Date; to: Date },
  expand: Expander,
): CalendarEvent[] {
  if (!rows.length) return events;
  const fromKey = format(range.from, "yyyy-MM-dd");
  const toKey = format(range.to, "yyyy-MM-dd");
  const extraDates = [...new Set(rows.map((r) => r.original_date).filter((d) => d < fromKey || d > toKey))];
  const extra = extraDates.flatMap((d) => {
    const day = new Date(`${d}T00:00:00`);
    return expand(day, new Date(`${d}T23:59:59`)).filter((e) => e.type === "lesson");
  });
  const owned: ScheduleOccurrence[] = [];
  const rest: CalendarEvent[] = [];
  for (const e of [...events, ...extra]) {
    const source = ownedSource(e, userId);
    if (source) owned.push({ ...e, source });
    else if (!extra.includes(e)) rest.push(e);
  }
  try {
    const effective = applyScheduleExceptions(owned, rows.map(rowToException), { start: range.from, end: range.to });
    const merged: CalendarEvent[] = effective.map(({ source: _s, isTeachingOccurrence: _t, exceptionId: _x, ...e }) => e);
    return [...rest, ...merged];
  } catch {
    return events;
  }
}

export async function fetchExceptionRows(from: Date, to: Date): Promise<ExceptionRow[]> {
  const { data, error } = await supabase.rpc("read_schedule_exceptions" as any, {
    _from: format(from, "yyyy-MM-dd"),
    _to: format(to, "yyyy-MM-dd"),
  });
  if (error) return [];
  return (data ?? []) as ExceptionRow[];
}

/** Next date (after `afterDate`) on which the same source occurs, within ~10 weeks. */
export function nextOccurrenceDate(source: ScheduleOccurrenceSource, afterDate: string, expand: Expander): string | null {
  const start = addDays(new Date(`${afterDate}T00:00:00`), 1);
  const found = expand(start, addDays(start, 70))
    .filter((e) => e.scheduleSource?.kind === source.kind && e.scheduleSource.slotId === source.slotId)
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  return found ? format(found.start, "yyyy-MM-dd") : null;
}

type Anchor = { date?: string; time?: string; subject?: string | null; classId?: string | null; groupId?: string | null };
type PlanRow = { id: string; subject: string | null; class_id: string | null; group_id: string | null; input_data: any };

/** Mirrors the server anchor match in save_schedule_exception (date, start, class/group, subject). */
export function planMatchesOccurrence(
  plan: PlanRow,
  occ: { date: string; start: string; subject?: string; classId?: string | null; groupId?: string | null },
): boolean {
  const input = plan.input_data ?? {};
  const anchors: Anchor[] = Array.isArray(input.linkedSlots) ? [...input.linkedSlots] : [];
  if (input.linkedDate) anchors.push({ date: input.linkedDate, time: input.linkedTime, subject: plan.subject, classId: plan.class_id, groupId: plan.group_id });
  const norm = (s?: string | null) => (s ?? "").trim().toLowerCase();
  const startOf = (t?: string) => (t ?? "").split("-")[0]?.trim().slice(0, 5).padStart(5, "0");
  return anchors.some((a) =>
    a.date === occ.date &&
    !!startOf(a.time) && startOf(a.time) === occ.start.padStart(5, "0") &&
    (a.classId || plan.class_id || null) === (occ.classId ?? null) &&
    (a.groupId || plan.group_id || null) === (occ.groupId ?? null) &&
    norm(a.subject ?? plan.subject) === norm(occ.subject));
}

export async function findLinkedPlans(userId: string, event: CalendarEvent, originalDate: string): Promise<PlanRow[]> {
  const { data } = await supabase
    .from("lesson_plans")
    .select("id, subject, class_id, group_id, input_data")
    .eq("teacher_id", userId);
  const start = format(event.originalStart ?? event.start, "HH:mm");
  return ((data ?? []) as PlanRow[]).filter((p) =>
    planMatchesOccurrence(p, { date: originalDate, start, subject: event.subject, classId: event.classId, groupId: event.groupId }));
}

export async function currentRevision(source: ScheduleOccurrenceSource): Promise<number> {
  const { data } = await supabase
    .from("schedule_exceptions" as any)
    .select("revision")
    .eq("owner_id", source.ownerId)
    .eq("source_kind", source.kind)
    .eq("source_id", source.slotId)
    .eq("original_date", source.originalDate)
    .maybeSingle();
  return (data as any)?.revision ?? 0;
}

export async function saveException(params: {
  source: ScheduleOccurrenceSource;
  action: "cancelled" | "moved" | "reverted";
  newDate?: string;
  newStart?: string;
  newEnd?: string;
  reason?: string;
  note?: string;
  planIds?: string[];
  planAction?: "unassigned" | "next";
  nextDate?: string | null;
}): Promise<void> {
  const revision = await currentRevision(params.source);
  const { error } = await supabase.rpc("save_schedule_exception" as any, {
    _kind: params.source.kind,
    _source_id: params.source.slotId,
    _original_date: params.source.originalDate,
    _action: params.action,
    _new_date: params.newDate ?? null,
    _new_start: params.newStart ?? null,
    _new_end: params.newEnd ?? null,
    _reason: params.reason ?? "",
    _note: params.note ?? "",
    _share: false,
    _expected_revision: revision,
    _request_id: crypto.randomUUID(),
    _plan_ids: params.planIds ?? [],
    _plan_action: params.planAction ?? "unassigned",
    _next_date: params.nextDate ?? null,
  });
  if (error) throw new Error(error.message || "Změnu se nepodařilo uložit.");
}

/**
 * Student/parent projection returned by the SECURITY DEFINER RPC
 * `student_schedule_changes`: no owner, no private notes; `public_reason`
 * is empty unless the teacher marked the reason as visible.
 */
export type StudentChangeRow = {
  id: string;
  source_kind: string;
  source_id: string;
  class_slot_id: string | null;
  original_date: string;
  action: string;
  new_date: string | null;
  new_start: string | null;
  new_end: string | null;
  class_id: string | null;
  group_id: string | null;
  public_reason: string | null;
};

/** On any error returns [] so the timetable renders exactly as before. */
export async function fetchStudentScheduleChanges(from: Date, to: Date): Promise<StudentChangeRow[]> {
  try {
    const { data, error } = await supabase.rpc("student_schedule_changes" as any, {
      _from: format(from, "yyyy-MM-dd"),
      _to: format(to, "yyyy-MM-dd"),
    });
    if (error || !Array.isArray(data)) return [];
    return data as StudentChangeRow[];
  } catch {
    return [];
  }
}

const VIEWER_OWNER = "viewer";

/**
 * Merge visible class-slot changes into a student's/parent's expanded lessons.
 * Matches by slot ID + original date only. Never throws: on bad data the
 * plain timetable is returned unchanged.
 */
export function mergeStudentScheduleChanges(
  events: CalendarEvent[],
  rows: StudentChangeRow[],
  range: { from: Date; to: Date },
  expand?: Expander,
): CalendarEvent[] {
  const usable = rows.filter((r) => r.source_kind === "class_slot" && (r.action === "cancelled" || r.action === "moved"));
  if (!usable.length) return events;
  const fromKey = format(range.from, "yyyy-MM-dd");
  const toKey = format(range.to, "yyyy-MM-dd");
  const extra = expand
    ? [...new Set(usable.map((r) => r.original_date).filter((d) => d < fromKey || d > toKey))].flatMap((d) =>
        expand(new Date(`${d}T00:00:00`), new Date(`${d}T23:59:59`)).filter((e) => e.type === "lesson"))
    : [];
  const sourced: ScheduleOccurrence[] = [];
  const rest: CalendarEvent[] = [];
  for (const e of [...events, ...extra]) {
    const s = e.scheduleSource;
    if (e.type === "lesson" && s?.kind === "class_slot") {
      sourced.push({ ...e, source: { kind: "class_slot", ownerId: VIEWER_OWNER, slotId: s.slotId,
        originalDate: format(e.originalStart ?? e.start, "yyyy-MM-dd") } });
    } else if (!extra.includes(e)) rest.push(e);
  }
  try {
    const exceptions: ScheduleException[] = usable.map((r) => ({
      id: r.id,
      source: { kind: "class_slot", ownerId: VIEWER_OWNER, slotId: r.source_id, originalDate: r.original_date },
      action: r.action as ScheduleException["action"],
      state: "active",
      newDate: r.new_date ?? undefined,
      newStart: hhmm(r.new_start),
      newEnd: hhmm(r.new_end),
      publicReason: (r.public_reason ?? "").trim() || undefined,
    }));
    const effective = applyScheduleExceptions(sourced, exceptions, { start: range.from, end: range.to });
    const merged: CalendarEvent[] = effective.map(({ source: _s, isTeachingOccurrence: _t, exceptionId: _x, ...e }) => e);
    return [...rest, ...merged].sort((a, b) => a.start.getTime() - b.start.getTime());
  } catch {
    return events;
  }
}

/** Lesson did not happen at this time (cancelled, or moved away). */
export function isLessonNotHeld(e: Pick<CalendarEvent, "scheduleStatus">): boolean {
  return e.scheduleStatus === "cancelled" || e.scheduleStatus === "moved_from";
}

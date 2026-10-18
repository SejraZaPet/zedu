import { format, startOfDay, endOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { expandScheduleSlots, type CalendarEvent, type ScheduleSlotInput } from "./calendar-utils";
import { expandTeacherSchedule, type TeacherScheduleData } from "./teacher-schedule-store";
import { applyScheduleExceptions, scheduleOccurrenceKey, type ScheduleOccurrence, type ScheduleException } from "./schedule-exceptions";
import type { Tables } from "@/integrations/supabase/types";

export type ScheduleExceptionRow = Tables<"schedule_exceptions">;
export type SchedulePlanLink = Tables<"schedule_plan_occurrence_links">;

export function exceptionFromRow(row: ScheduleExceptionRow): ScheduleException {
  return { id: row.id, source: { kind: row.source_kind === "personal" ? "personal" : "class_slot",
    ownerId: row.owner_id, slotId: row.source_id, originalDate: row.original_date },
    action: row.action === "moved" ? "moved" : "cancelled", state: row.state === "active" ? "active" : "reverted",
    newDate: row.new_date ?? undefined, newStart: row.new_start ?? undefined, newEnd: row.new_end ?? undefined,
    publicReason: row.public_reason };
}

export async function readScheduleChanges(from: Date, to: Date): Promise<ScheduleExceptionRow[]> {
  const { data, error } = await supabase.rpc("read_schedule_exceptions", { _from: format(from, "yyyy-MM-dd"), _to: format(to, "yyyy-MM-dd") });
  if (error) throw new Error("Změny rozvrhu se nepodařilo načíst. Obnovte prosím stránku.");
  return data ?? [];
}

/** Includes moved-in origins explicitly; never expands every day between distant dates. */
export function projectScheduleChanges(
  slots: ScheduleSlotInput[], from: Date, to: Date, rows: ScheduleExceptionRow[],
  personal?: { data: TeacherScheduleData; ownerId: string },
): CalendarEvent[] {
  const expand = (a: Date, b: Date): CalendarEvent[] => [
    ...expandScheduleSlots(slots, a, b),
    ...(personal ? expandTeacherSchedule(personal.data, a, b, personal.ownerId) : []),
  ];
  const events = expand(from, to);
  const originalDates = new Set(rows.map((row) => row.original_date));
  for (const date of originalDates) {
    const day = new Date(`${date}T12:00:00`);
    if (day < startOfDay(from) || day > endOfDay(to)) events.push(...expand(startOfDay(day), endOfDay(day)));
  }
  const occurrences: ScheduleOccurrence[] = [];
  const seen = new Set<string>();
  for (const event of events) {
    if (!event.source) continue;
    const key = scheduleOccurrenceKey(event.source);
    if (seen.has(key)) continue;
    seen.add(key);
    occurrences.push({ ...event, source: event.source });
  }
  const revisions = new Map(rows.map((row) => [row.id, row.revision]));
  return applyScheduleExceptions(occurrences, rows.map(exceptionFromRow), { start: from, end: to })
    .map((event) => ({ ...event, exceptionRevision: event.exceptionId ? revisions.get(event.exceptionId) : undefined }));
}

export async function readPlanOccurrenceLinks(planIds: string[]): Promise<SchedulePlanLink[]> {
  if (!planIds.length) return [];
  const { data, error } = await supabase.from("schedule_plan_occurrence_links").select("*").in("plan_id", planIds);
  if (error) throw new Error("Změny termínů plánů se nepodařilo načíst.");
  return data ?? [];
}

/** Read projection only; the editor keeps original anchors for safe existing saves. */
export function projectPlanInput(input: Record<string, any>, links: SchedulePlanLink[]): Record<string, any> {
  const result = { ...input, linkedSlots: [...(input.linkedSlots ?? [])] };
  for (const link of links) {
    if (link.state === "reverted") continue;
    const anchor = link.anchor as Record<string, any>;
    const date = link.effective_date ?? "";
    const time = link.effective_start ? `${link.effective_start.slice(0, 5)}-${link.effective_end?.slice(0, 5) ?? ""}` : "";
    if (anchor.primary && input.linkedDate === anchor.date && input.linkedTime === anchor.time) {
      result.linkedDate = date;
      result.linkedTime = time;
    } else if (!anchor.primary) {
      result.linkedSlots = result.linkedSlots.flatMap((slot: Record<string, any>) => {
        if (slot.date !== anchor.date || slot.time !== anchor.time || slot.subject !== anchor.subject ||
            (slot.classId ?? null) !== (anchor.classId ?? null) || (slot.groupId ?? null) !== (anchor.groupId ?? null)) return [slot];
        return date ? [{ ...slot, date, time }] : [];
      });
    }
  }
  return result;
}

export function scheduleChangeLabel(event: CalendarEvent): string | null {
  if (event.scheduleStatus === "cancelled") return "Zrušeno";
  if (event.scheduleStatus === "moved_from" && event.movedStart) return `Přesunuto na ${format(event.movedStart, "d. M. HH:mm")}`;
  if (event.scheduleStatus === "moved_to" && event.originalStart) return `Přesunuto z ${format(event.originalStart, "d. M. HH:mm")}`;
  return null;
}
import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { expandScheduleSlots, type ScheduleSlotInput } from "@/lib/calendar-utils";
import { mergeExceptions, nextOccurrenceDate, ownedSource, planMatchesOccurrence, type ExceptionRow } from "@/lib/schedule-exception-store";

const slot: ScheduleSlotInput = {
  id: "slot-1", class_id: "class-1", day_of_week: 1, start_time: "08:00", end_time: "08:45",
  week_parity: "every", valid_from: null, valid_to: null, subject_label: "Matematika", room: "", created_by: "me",
};
const expand = (f: Date, t: Date) => expandScheduleSlots([slot], f, t);
const week = { from: new Date("2026-11-02T00:00:00"), to: new Date("2026-11-08T23:59:59") };
const row = (p: Partial<ExceptionRow>): ExceptionRow => ({
  id: "x1", owner_id: "me", source_kind: "class_slot", source_id: "slot-1", original_date: "2026-11-02",
  action: "cancelled", state: "active", new_date: null, new_start: null, new_end: null, public_reason: "Exkurze", revision: 1, ...p,
});

describe("teacher one-off exceptions in the calendar", () => {
  it("leaves the timetable unchanged without exceptions", () => {
    const events = expand(week.from, week.to);
    expect(mergeExceptions(events, [], "me", week, expand)).toBe(events);
  });
  it("marks a cancelled lesson as Zrušeno with its reason", () => {
    const [ev] = mergeExceptions(expand(week.from, week.to), [row({})], "me", week, expand);
    expect(ev?.scheduleStatus).toBe("cancelled");
    expect(ev?.publicReason).toBe("Exkurze");
  });
  it("shows the original as moved_from and the new term as moved_to", () => {
    const out = mergeExceptions(expand(week.from, week.to), [row({ action: "moved", new_date: "2026-11-04", new_start: "10:00:00", new_end: "10:45:00" })], "me", week, expand);
    expect(out.map((e) => e.scheduleStatus)).toEqual(["moved_from", "moved_to"]);
    expect(out[1]?.start.toISOString()).toBe("2026-11-04T09:00:00.000Z");
  });
  it("brings in a lesson moved from another week", () => {
    const next = { from: new Date("2026-11-09T00:00:00"), to: new Date("2026-11-15T23:59:59") };
    const out = mergeExceptions(expand(next.from, next.to), [row({ action: "moved", new_date: "2026-11-10", new_start: "09:00", new_end: "09:45" })], "me", next, expand);
    expect(out.filter((e) => e.scheduleStatus === "moved_to")).toHaveLength(1);
    expect(out.filter((e) => !e.scheduleStatus)).toHaveLength(1);
  });
  it("never applies exceptions to slots the teacher does not own", () => {
    const events = expand(week.from, week.to);
    expect(ownedSource(events[0]!, "someone-else")).toBeNull();
    expect(mergeExceptions(events, [row({})], "someone-else", week, expand)[0]?.scheduleStatus).toBeUndefined();
  });
  it("finds the next occurrence of the same lesson for a cancelled plan", () => {
    const src = ownedSource(expand(week.from, week.to)[0]!, "me")!;
    expect(nextOccurrenceDate(src, "2026-11-02", expand)).toBe("2026-11-09");
  });
  it("matches linked plans only on date, start, class and subject", () => {
    const plan = { id: "p", subject: "Matematika", class_id: "class-1", group_id: null, input_data: { linkedDate: "2026-11-02", linkedTime: "08:00-08:45" } };
    const occ = { date: "2026-11-02", start: "08:00", subject: "matematika ", classId: "class-1", groupId: null };
    expect(planMatchesOccurrence(plan, occ)).toBe(true);
    expect(planMatchesOccurrence(plan, { ...occ, start: "08:55" })).toBe(false);
    expect(planMatchesOccurrence(plan, { ...occ, classId: "class-2" })).toBe(false);
  });
});

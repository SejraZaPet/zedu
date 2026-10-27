import { describe, expect, it, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: vi.fn() } }));
import { isLessonNotHeld, mergeStudentScheduleChanges, type StudentChangeRow } from "@/lib/schedule-exception-store";
import type { CalendarEvent } from "@/lib/calendar-utils";

const lesson = (slotId: string, date: string, h = 8): CalendarEvent => ({
  id: `${slotId}-${date}`, type: "lesson", title: "Matematika",
  start: new Date(`${date}T0${h}:00:00`), end: new Date(`${date}T0${h}:45:00`),
  scheduleSource: { kind: "class_slot", slotId, createdBy: "t1" },
});
const row = (p: Partial<StudentChangeRow>): StudentChangeRow => ({
  id: "x1", source_kind: "class_slot", source_id: "s1", class_slot_id: "s1", original_date: "2026-10-28",
  action: "cancelled", new_date: null, new_start: null, new_end: null, class_id: "c1", group_id: null,
  public_reason: "", ...p,
});
const range = { from: new Date("2026-10-26T00:00:00"), to: new Date("2026-11-01T23:59:59") };

describe("student schedule changes", () => {
  it("marks cancelled lesson and carries visible reason", () => {
    const out = mergeStudentScheduleChanges([lesson("s1", "2026-10-28")], [row({ public_reason: "Exkurze" })], range);
    expect(out[0].scheduleStatus).toBe("cancelled");
    expect(out[0].publicReason).toBe("Exkurze");
    expect(isLessonNotHeld(out[0])).toBe(true);
  });
  it("hides empty reason", () => {
    const out = mergeStudentScheduleChanges([lesson("s1", "2026-10-28")], [row({})], range);
    expect(out[0].publicReason).toBeUndefined();
  });
  it("leaves other slots/dates untouched", () => {
    const out = mergeStudentScheduleChanges([lesson("s2", "2026-10-28"), lesson("s1", "2026-10-29")], [row({})], range);
    expect(out.every((e) => !e.scheduleStatus)).toBe(true);
  });
  it("moved lesson appears on new date as moved_to", () => {
    const out = mergeStudentScheduleChanges([lesson("s1", "2026-10-28")],
      [row({ action: "moved", new_date: "2026-10-30", new_start: "10:00:00", new_end: "10:45:00" })], range);
    expect(out.find((e) => e.scheduleStatus === "moved_to")?.start.getDate()).toBe(30);
    expect(out.find((e) => e.scheduleStatus === "moved_from")).toBeTruthy();
  });
  it("bad data returns timetable unchanged", () => {
    const events = [lesson("s1", "2026-10-28")];
    const out = mergeStudentScheduleChanges(events, [row({ action: "moved", new_date: null })], range);
    expect(out).toBe(events);
  });
});

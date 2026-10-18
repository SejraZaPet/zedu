import { describe, expect, it } from "vitest";
import {
  applyScheduleExceptions, effectivePlanOccurrence, pragueCalendarDate,
  resolvePragueTime, scheduleOccurrenceKey, scheduleTimeConflicts,
  type ScheduleException, type ScheduleOccurrence,
} from "@/lib/schedule-exceptions";

function lesson(date = "2026-11-02", slotId = "slot-1"): ScheduleOccurrence {
  return {
    id: `${slotId}-${date}`, type: "lesson", title: "Matematika", classId: "class-1",
    start: resolvePragueTime(date, "08:00"), end: resolvePragueTime(date, "08:45"),
    source: { kind: "class_slot", ownerId: "teacher-1", slotId, originalDate: date },
  };
}
const base = lesson();
const november = { start: resolvePragueTime("2026-11-01", "00:00"), end: resolvePragueTime("2026-11-30", "23:59") };
function move(): ScheduleException {
  return { id: "exception-1", source: base.source, state: "active", action: "moved",
    newDate: "2026-11-03", newStart: "09:00", newEnd: "09:45" };
}

describe("single schedule exceptions", () => {
  it("preserves the recurring timetable and identifiers when there are no exceptions", () => {
    const before = structuredClone(base);
    const result = applyScheduleExceptions([base], [], november);
    expect(result).toEqual([{ ...base, isTeachingOccurrence: true }]);
    expect(base).toEqual(before);
  });
  it("moves only one source/date with one teaching occurrence and two visible markers", () => {
    const nextWeek = lesson("2026-11-09");
    const result = applyScheduleExceptions([base, nextWeek], [move()], november);
    expect(result.map((event) => event.scheduleStatus)).toEqual(["moved_from", "moved_to", undefined]);
    expect(result.filter((event) => event.isTeachingOccurrence)).toHaveLength(2);
    expect(effectivePlanOccurrence(base.source, result)?.start.toISOString()).toBe("2026-11-03T08:00:00.000Z");
    expect(base.start.toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });
  it("cancels one occurrence without offering the cancelled term to a plan", () => {
    const cancel: ScheduleException = { id: "cancel", source: base.source, state: "active", action: "cancelled" };
    const result = applyScheduleExceptions([base], [cancel], november);
    expect(result[0]?.scheduleStatus).toBe("cancelled");
    expect(result[0]?.isTeachingOccurrence).toBe(false);
    expect(effectivePlanOccurrence(base.source, result)).toBeNull();
  });
  it("reverts an exception without rewriting the original slot", () => {
    const result = applyScheduleExceptions([base], [{ ...move(), state: "reverted" }], november);
    expect(result).toEqual([{ ...base, isTeachingOccurrence: true }]);
  });
  it("rejects two active exceptions for the same source and original date", () => {
    expect(() => applyScheduleExceptions([base], [move(), { ...move(), id: "duplicate" }], november)).toThrow();
  });
  it("keeps identically timed personal and classroom sources distinct", () => {
    const personal = { ...base, id: "personal", source: { ...base.source, kind: "personal" as const } };
    const result = applyScheduleExceptions([base, personal], [move()], november);
    expect(result.find((event) => event.id === "personal")?.scheduleStatus).toBeUndefined();
    expect(scheduleOccurrenceKey(personal.source)).not.toBe(scheduleOccurrenceKey(base.source));
  });
  it("never applies an exception belonging to another owner", () => {
    const other = { ...move(), source: { ...base.source, ownerId: "teacher-2" } };
    expect(applyScheduleExceptions([base], [other], november)[0]?.scheduleStatus).toBeUndefined();
  });
  it("shows a moved-in occurrence even when its original date is outside the range", () => {
    const range = { start: resolvePragueTime("2026-11-03", "00:00"), end: resolvePragueTime("2026-11-03", "23:59") };
    const result = applyScheduleExceptions([base], [move()], range);
    expect(result).toHaveLength(1);
    expect(result[0]?.scheduleStatus).toBe("moved_to");
  });
  it("retains a moved-out marker when the destination is outside the range", () => {
    const result = applyScheduleExceptions([base], [{ ...move(), newDate: "2026-12-01" }], november);
    expect(result).toHaveLength(1);
    expect(result[0]?.scheduleStatus).toBe("moved_from");
    expect(result[0]?.isTeachingOccurrence).toBe(false);
  });
  it("uses original identity across year/ISO parity changes rather than reapplying at destination", () => {
    const original = lesson("2026-12-28");
    const exception = { ...move(), source: original.source, newDate: "2027-01-04" };
    const result = applyScheduleExceptions([original], [exception], {
      start: resolvePragueTime("2026-12-28", "00:00"), end: resolvePragueTime("2027-01-04", "23:59"),
    });
    expect(result.filter((event) => event.isTeachingOccurrence)).toHaveLength(1);
    expect(result[1]?.source.originalDate).toBe("2026-12-28");
  });
  it("warns about overlapping teaching times but not adjacent or cancelled slots", () => {
    const result = applyScheduleExceptions([base, lesson("2026-11-02", "cancelled")], [{
      id: "cancel", source: lesson("2026-11-02", "cancelled").source, action: "cancelled", state: "active",
    }], november);
    expect(scheduleTimeConflicts({ start: resolvePragueTime("2026-11-02", "08:30"), end: resolvePragueTime("2026-11-02", "09:00") }, result)).toHaveLength(1);
    expect(scheduleTimeConflicts({ start: base.end, end: resolvePragueTime("2026-11-02", "09:00") }, result)).toHaveLength(0);
    expect(scheduleTimeConflicts(base, result, base.source)).toHaveLength(0);
  });
  it("rejects incomplete moves and end times preceding the start", () => {
    expect(() => applyScheduleExceptions([base], [{ ...move(), newDate: undefined }], november)).toThrow();
    expect(() => applyScheduleExceptions([base], [{ ...move(), newEnd: "08:45" }], november)).toThrow();
  });
});

describe("Prague calendar time", () => {
  it("keeps 08:00 at 08:00 across the March summer-time transition", () => {
    expect(resolvePragueTime("2026-03-27", "08:00").toISOString()).toBe("2026-03-27T07:00:00.000Z");
    expect(resolvePragueTime("2026-03-30", "08:00").toISOString()).toBe("2026-03-30T06:00:00.000Z");
  });
  it("keeps 08:00 at 08:00 across the October winter-time transition", () => {
    expect(resolvePragueTime("2026-10-23", "08:00").toISOString()).toBe("2026-10-23T06:00:00.000Z");
    expect(resolvePragueTime("2026-10-26", "08:00").toISOString()).toBe("2026-10-26T07:00:00.000Z");
  });
  it("rejects nonexistent and ambiguous DST clock times", () => {
    expect(() => resolvePragueTime("2026-03-29", "02:30")).toThrow();
    expect(() => resolvePragueTime("2026-10-25", "02:30")).toThrow();
  });
  it("uses Prague date rather than the UTC date near midnight", () => {
    expect(pragueCalendarDate(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-02");
  });
  it("rejects invalid dates and clock times instead of normalizing them", () => {
    for (const [date, time] of [["2026-02-30", "08:00"], ["2026-11-02", "24:00"], ["2026-11-02", "08:60"], ["wrong", "08:00"]]) {
      expect(() => resolvePragueTime(date, time)).toThrow();
    }
  });
});
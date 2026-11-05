import { describe, expect, it } from "vitest";
import { anchorScroll, isGesturePointer, pinchZoom } from "@/lib/notebook-gestures";
import { splitDayAgenda } from "@/lib/calendar-day-agenda";
import type { CalendarEvent } from "@/lib/calendar-utils";

describe("notebook gestures", () => {
  it("pinch doubling finger distance doubles zoom", () => expect(pinchZoom(1, 100, 200)).toBe(2));
  it("pinch clamps to 50–250 %", () => {
    expect(pinchZoom(2, 100, 400)).toBe(2.5);
    expect(pinchZoom(1, 400, 100)).toBe(0.5);
  });
  it("keeps the point under the fingers fixed", () => {
    // content x under anchor 100 at scroll 0 is 100; after 2x it is 200 → scroll 100
    expect(anchorScroll(0, 100, 2)).toBe(100);
  });
  it("in pen-only mode a finger pans, a pen draws", () => {
    expect(isGesturePointer("touch", { hand: false, penOnly: true, touchCount: 1 })).toBe(true);
    expect(isGesturePointer("pen", { hand: false, penOnly: true, touchCount: 1 })).toBe(false);
  });
  it("two fingers always pinch, one finger draws when pen-only is off", () => {
    expect(isGesturePointer("touch", { hand: false, penOnly: false, touchCount: 2 })).toBe(true);
    expect(isGesturePointer("touch", { hand: false, penOnly: false, touchCount: 1 })).toBe(false);
  });
});

describe("calendar day agenda", () => {
  const ev = (id: string, type: CalendarEvent["type"], h: number, m: number): CalendarEvent => ({
    id, type, title: id, start: new Date(2026, 10, 5, h, m), end: new Date(2026, 10, 5, h, m + 45),
  });
  it("sorts lessons and keeps a 23:59 deadline", () => {
    const { lessons, deadlines } = splitDayAgenda(
      [ev("b", "lesson", 10, 40), ev("a", "lesson", 9, 50), ev("d", "assignment", 23, 59), ev("c", "assignment", 9, 50)],
      new Date(2026, 10, 5),
    );
    expect(lessons.map((e) => e.id)).toEqual(["a", "b"]);
    expect(deadlines.map((e) => e.id)).toEqual(["c", "d"]);
  });
});

import { fitWidth } from "@/lib/notebook-gestures";
import { deadlineTone, filterCalendarAssignments, deadlinesForDay, layoutOverlaps } from "@/lib/calendar-deadlines";

describe("notebook modes", () => {
  it("select tool: one finger pans; mouse in select does not", () => {
    expect(isGesturePointer("touch", { hand: false, penOnly: false, touchCount: 1, select: true })).toBe(true);
    expect(isGesturePointer("mouse", { hand: false, penOnly: false, touchCount: 0, select: true })).toBe(false);
  });
  it("hand tool pans even with pen", () => expect(isGesturePointer("pen", { hand: true, penOnly: false, touchCount: 0 })).toBe(true));
  it("fit width = 100 % at start", () => expect(fitWidth()).toEqual({ zoom: 1, scrollLeft: 0, scrollTop: 0 }));
});

describe("calendar deadlines", () => {
  const now = new Date(2026, 10, 5, 12, 0);
  it("tones: past red, within 24 h orange, later grey", () => {
    expect(deadlineTone(new Date(2026, 10, 5, 11, 0), now)).toBe("overdue");
    expect(deadlineTone(new Date(2026, 10, 5, 23, 59), now)).toBe("soon");
    expect(deadlineTone(new Date(2026, 10, 7, 9, 0), now)).toBe("later");
  });
  it("drops materials, announcements and submitted tasks", () => {
    const rows = [
      { id: "t", settings: {} }, { id: "m", settings: { kind: "material" } },
      { id: "a", settings: { kind: "announcement" } }, { id: "s", settings: { kind: "task" } },
    ];
    expect(filterCalendarAssignments(rows, new Set(["s"])).map((r) => r.id)).toEqual(["t"]);
  });
  it("a 23:59 deadline appears in the day markers", () => {
    const e = { id: "x", type: "assignment" as const, title: "x", start: new Date(2026, 10, 5, 23, 59), end: new Date(2026, 10, 6, 0, 29) };
    expect(deadlinesForDay([e], new Date(2026, 10, 5))).toHaveLength(1);
  });
  it("overlapping lessons get side-by-side columns", () => {
    const d = (h: number, m: number) => new Date(2026, 10, 5, h, m);
    const l = layoutOverlaps([
      { id: "a", start: d(9, 50), end: d(10, 35) }, { id: "b", start: d(10, 0), end: d(10, 45) }, { id: "c", start: d(11, 0), end: d(11, 45) },
    ]);
    expect(l.a).toEqual({ col: 0, cols: 2 });
    expect(l.b).toEqual({ col: 1, cols: 2 });
    expect(l.c).toEqual({ col: 0, cols: 1 });
  });
});

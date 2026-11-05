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

// @vitest-environment node
import { describe, it, expect } from "vitest";
import { globalScheduleIso, resolveTargetSchedule, scheduleBlocker } from "@/lib/assignment-schedule";
const now = new Date("2026-11-22T12:00:00Z").getTime();
const g = new Date("2026-11-23T07:00:00Z").toISOString();
describe("assignment scheduling", () => {
  it("global date enables and applies to targets without own time", () => {
    expect(scheduleBlocker(g, [{ key: "a", publishAt: "" }])).toBeNull();
    expect(resolveTargetSchedule(g, [{ key: "a", publishAt: "" }], now)).toEqual([g]);
  });
  it("only per-target times enable Naplánovat", () => {
    const t = [{ key: "a", publishAt: "2026-11-23T08:07" }];
    expect(scheduleBlocker(null, t)).toBeNull();
    expect(resolveTargetSchedule(null, t, now)).toEqual([new Date("2026-11-23T08:07").toISOString()]);
  });
  it("nothing → concrete message", () => {
    expect(scheduleBlocker(null, [])).toMatch(/třídu nebo skupinu/);
    expect(scheduleBlocker(null, [{ key: "a", publishAt: "" }])).toMatch(/nahoře nebo u každého cíle/);
    expect(scheduleBlocker(null, [{ key: "a", publishAt: "2026-11-23T08:07" }, { key: "b", publishAt: "" }])).toMatch(/jednoho cíle/);
    expect(() => resolveTargetSchedule(null, [], now)).toThrow();
  });
  it("past time rejected unless unchanged", () => {
    const past = new Date("2026-11-20T08:00:00Z").toISOString();
    expect(() => resolveTargetSchedule(null, [{ key: "a", publishAt: "2026-11-20T08:00" }], now)).toThrow(/budoucnosti/);
    expect(() => resolveTargetSchedule(past, [{ key: "a", publishAt: "" }], now)).toThrow(/budoucnosti/);
    expect(resolveTargetSchedule(past, [{ key: "a", publishAt: "" }], now, past)).toEqual([past]);
  });
  it("globalScheduleIso combines date and time", () => {
    expect(globalScheduleIso(null, "08:00")).toBeNull();
    const d = new Date(2026, 10, 23); expect(new Date(globalScheduleIso(d, "08:07")!).getHours()).toBe(8);
  });
});

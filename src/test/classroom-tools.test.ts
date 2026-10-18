import { describe, expect, it } from "vitest";
import { drawClassroomPerson, formatClassroomTime, parseClassroomNames, splitClassroomGroups } from "@/lib/classroom-tools";

const pupils = parseClassroomNames("Anna\nBoris\nCyril\nDana\nEva\nFilip\nGita");
describe("classroom tools", () => {
  it("never draws an already drawn pupil with no-repeat enabled", () => {
    const drawn: string[] = [];
    for (let i = 0; i < pupils.length; i++) {
      const p = drawClassroomPerson(pupils, drawn, true, () => 0);
      expect(p).not.toBeNull();
      if (p) { expect(drawn).not.toContain(p.id); drawn.push(p.id); }
    }
    expect(drawClassroomPerson(pupils, drawn, true)).toBeNull();
  });
  it("allows repetition when selected", () => {
    expect(drawClassroomPerson(pupils, [pupils[0].id], false, () => 0)?.id).toBe(pupils[0].id);
  });
  it("keeps identically named pupils distinct", () => {
    const p = parseClassroomNames("Anna\nAnna");
    expect(drawClassroomPerson(p, [p[0].id], true, () => 0)?.id).toBe(p[1].id);
  });
  it("splits into N balanced groups with each pupil exactly once", () => {
    const g = splitClassroomGroups(pupils, "count", 3, () => 0.4);
    expect(g.map(x => x.length)).toEqual([3, 2, 2]);
    expect(g.flat().map(x => x.id).sort()).toEqual(pupils.map(x => x.id).sort());
  });
  it("never exceeds K people per group", () => {
    const g = splitClassroomGroups(pupils, "size", 2, () => 0.4);
    expect(g.map(x => x.length)).toEqual([2, 2, 2, 1]);
    expect(new Set(g.flat().map(x => x.id)).size).toBe(7);
  });
  it("handles empty lists and invalid group counts", () => {
    expect(splitClassroomGroups([], "count", 2)).toEqual([]);
    expect(splitClassroomGroups(pupils, "count", 0)).toEqual([]);
    expect(splitClassroomGroups(pupils, "count", 100)).toHaveLength(7);
  });
  it("formats minutes, hours, tenths and zero", () => {
    expect(formatClassroomTime(65000)).toBe("01:05");
    expect(formatClassroomTime(3605000)).toBe("1:00:05");
    expect(formatClassroomTime(1250, true)).toBe("00:01.2");
    expect(formatClassroomTime(-10)).toBe("00:00");
  });
});
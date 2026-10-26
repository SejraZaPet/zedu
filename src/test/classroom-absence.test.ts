import { describe, it, expect, beforeEach } from "vitest";
import { drawClassroomPerson, loadClassroomAbsent, presentClassroomPeople, saveClassroomAbsent, splitClassroomGroups } from "@/lib/classroom-tools";

const people = [{ id: "a", name: "Ada" }, { id: "b", name: "Bob" }, { id: "c", name: "Cyril" }];
const day1 = new Date("2026-10-26T10:00:00Z");
const day2 = new Date("2026-10-27T10:00:00Z");

describe("nepřítomní žáci v losování a skupinách", () => {
  beforeEach(() => localStorage.clear());
  it("losuje jen přítomné", () => {
    const present = presentClassroomPeople(people, ["a", "c"]);
    for (let i = 0; i < 20; i++) expect(drawClassroomPerson(present, [], true, () => i / 20)?.id).toBe("b");
  });
  it("skupiny jen z přítomných", () => {
    const ids = splitClassroomGroups(presentClassroomPeople(people, ["b"]), "count", 2).flat().map(p => p.id).sort();
    expect(ids).toEqual(["a", "c"]);
  });
  it("absence platí jen pro dnešek a ukládá jen ID", () => {
    saveClassroomAbsent("class:x", ["a"], day1);
    expect(loadClassroomAbsent("class:x", day1)).toEqual(["a"]);
    expect(JSON.stringify({ ...localStorage })).not.toContain("Ada");
    expect(loadClassroomAbsent("class:x", day2)).toEqual([]);
    expect(localStorage.length).toBe(0);
  });
  it("vlastní seznam se nepamatuje", () => {
    saveClassroomAbsent("manual", ["manual-0"], day1);
    expect(localStorage.length).toBe(0);
  });
  it("nedostupné úložiště nespadne", () => {
    const broken = { get length() { throw new Error("x"); }, setItem() { throw new Error("x"); } } as unknown as Storage;
    expect(loadClassroomAbsent("class:x", day1, broken)).toEqual([]);
    expect(() => saveClassroomAbsent("class:x", ["a"], day1, broken)).not.toThrow();
  });
});

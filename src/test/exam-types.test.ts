import { describe, it, expect } from "vitest";
import { EXAM_TYPE_OPTIONS, getExamTypeMeta } from "@/lib/exam-types";

describe("exam types", () => {
  it("pořadí obsahuje Práci v hodině hned po Úkolu", () => {
    expect(EXAM_TYPE_OPTIONS.map((o) => o.label)).toEqual(["Úkol", "Práce v hodině", "Ústní zkoušení", "Písemné", "Digitální test", "Projekt"]);
  });
  it("Práce v hodině má vlastní barvu a ikonu", () => {
    const m = getExamTypeMeta("prace_v_hodine");
    expect(m.label).toBe("Práce v hodině");
    const others = EXAM_TYPE_OPTIONS.filter((o) => o.value !== "prace_v_hodine");
    expect(others.some((o) => o.color === m.color || o.icon === m.icon)).toBe(false);
  });
  it("neznámý/prázdný typ zůstává Úkol", () => {
    expect(getExamTypeMeta(null).value).toBe("ukol");
  });
});

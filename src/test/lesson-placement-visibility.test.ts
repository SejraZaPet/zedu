import { describe, expect, it } from "vitest";
import { isPlacementVisibleToStudent } from "@/lib/lesson-placement-visibility";

const student = {
  classIds: new Set(["class-a"]),
  subjectGroupIds: new Set(["group-a"]),
  gradeNumbers: new Set([2]),
};

describe("lesson placement visibility", () => {
  it("allows a matching class across all grades", () => {
    expect(isPlacementVisibleToStudent({
      class_id: "class-a",
      subject_group_id: null,
      grade_number: 1,
      scope_all_grades: true,
    }, student)).toBe(true);
  });

  it("rejects another class even in the same all-grades scope", () => {
    expect(isPlacementVisibleToStudent({
      class_id: "class-b",
      subject_group_id: null,
      grade_number: 1,
      scope_all_grades: true,
    }, student)).toBe(false);
  });

  it("requires the grade when all-grades scope is disabled", () => {
    expect(isPlacementVisibleToStudent({
      class_id: null,
      subject_group_id: null,
      grade_number: 1,
      scope_all_grades: false,
    }, student)).toBe(false);
  });
});
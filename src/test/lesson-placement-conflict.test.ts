import { describe, it, expect } from "vitest";
import { hasPlacementConflict, placementsConflict } from "@/lib/lesson-placement-conflict";

const base = { topic_id: "maso", target_type: "group" as const, school_term: "full_year" as const };

describe("placement conflict", () => {
  it("different groups on same topic are not a conflict", () => {
    expect(placementsConflict({ ...base, subject_group_id: "c2a" }, { ...base, subject_group_id: "c3a" })).toBe(false);
  });
  it("same group and full year is a conflict", () => {
    expect(hasPlacementConflict([{ ...base, subject_group_id: "g" }, { ...base, subject_group_id: "g" }], 0)).toBe(true);
  });
  it("same group, different halves do not overlap", () => {
    expect(placementsConflict(
      { ...base, subject_group_id: "g", school_term: "first_half" },
      { ...base, subject_group_id: "g", school_term: "second_half" },
    )).toBe(false);
  });
  it("full year overlaps with a half", () => {
    expect(placementsConflict({ ...base, subject_group_id: "g" }, { ...base, subject_group_id: "g", school_term: "first_half" })).toBe(true);
  });
  it("different topics never conflict", () => {
    expect(placementsConflict({ ...base, subject_group_id: "g" }, { ...base, topic_id: "x", subject_group_id: "g" })).toBe(false);
  });
});

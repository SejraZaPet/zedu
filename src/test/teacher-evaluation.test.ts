import { describe, expect, it } from "vitest";
import { practicePercent, teacherEvaluationTargets } from "@/lib/teacher-evaluation";

const members = {
  classMembers: [{ class_id: "c1", user_id: "s1" }, { class_id: "c1", user_id: "s2" }],
  groupMembers: [{ group_id: "g1", student_id: "s3" }],
};

describe("podklady interního vyhodnocení", () => {
  it("u úkolu pro celou třídu použije všechny členy", () => {
    expect(teacherEvaluationTargets({ id: "a1", class_id: "c1", group_id: null }, { ...members, recipientsMap: {} })).toEqual(["s1", "s2"]);
  });

  it("u omezeného publika použije průnik členů a příjemců", () => {
    expect(teacherEvaluationTargets({ id: "a1", class_id: "c1", group_id: null }, { ...members, recipientsMap: { a1: ["s2", "cizi"] } })).toEqual(["s2"]);
  });

  it("u skupiny použije jen členy skupiny", () => {
    expect(teacherEvaluationTargets({ id: "a2", class_id: null, group_id: "g1" }, { ...members, recipientsMap: {} })).toEqual(["s3"]);
  });

  it("procvičování čte procenta bez předání doslovných odpovědí", () => {
    expect(practicePercent({ score: 3, answers_json: { percent: 75, answers: { tajne: "odpověď" } } })).toBe(75);
  });

  it("staré procvičování dopočítá procenta jen ze skóre a počtu otázek", () => {
    expect(practicePercent({ score: 3, answers_json: { totalScorable: 4 } })).toBe(75);
    expect(practicePercent({ score: 3, answers_json: null })).toBeNull();
  });
});

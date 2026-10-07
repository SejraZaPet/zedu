import { describe, it, expect } from "vitest";
import {
  ALL_SCOPE, NO_SUBJECT, classScope, groupScope, groupsFullyInClass,
  filterAssignments, subjectOptions, keepSubject, assignmentInScope,
} from "@/lib/results-filters";

const classMembers = [
  { class_id: "A", user_id: "s1" }, { class_id: "A", user_id: "s2" },
  { class_id: "B", user_id: "s3" },
];
const groupMembers = [
  { group_id: "gA", student_id: "s1" }, { group_id: "gA", student_id: "s2" },
  { group_id: "gMix", student_id: "s1" }, { group_id: "gMix", student_id: "s3" },
  { group_id: "gOut", student_id: "x9" },
];
const list = [
  { id: "1", class_id: "A", group_id: null, subject: "Gastronomie" },
  { id: "2", class_id: "A", group_id: null, subject: null },
  { id: "3", class_id: null, group_id: "gA", subject: "Hygiena" },
  { id: "4", class_id: null, group_id: "gMix", subject: "Gastronomie" },
  { id: "5", class_id: "B", group_id: null, subject: "Matematika" },
];

describe("results filters", () => {
  const g2c = groupsFullyInClass(groupMembers, classMembers);

  it("skupinu přiřadí třídě jen když jsou všichni členové z ní", () => {
    expect(g2c.get("gA")).toBe("A");
    expect(g2c.has("gMix")).toBe(false);
    expect(g2c.has("gOut")).toBe(false);
  });

  it("filtruje podle třídy i skupiny", () => {
    expect(filterAssignments(list, classScope("A"), ALL_SCOPE, g2c).map((a) => a.id)).toEqual(["1", "2", "3"]);
    expect(filterAssignments(list, groupScope("gMix"), ALL_SCOPE, g2c).map((a) => a.id)).toEqual(["4"]);
    expect(filterAssignments(list, ALL_SCOPE, ALL_SCOPE, g2c)).toHaveLength(5);
  });

  it("předměty jen z vybrané třídy, Bez předmětu na konci", () => {
    const scoped = list.filter((a) => assignmentInScope(a, classScope("A"), g2c));
    expect(subjectOptions(scoped)).toEqual([
      { value: "Gastronomie", label: "Gastronomie" },
      { value: "Hygiena", label: "Hygiena" },
      { value: NO_SUBJECT, label: "Bez předmětu" },
    ]);
    expect(filterAssignments(list, classScope("A"), NO_SUBJECT, g2c).map((a) => a.id)).toEqual(["2"]);
    expect(filterAssignments(list, classScope("A"), "Hygiena", g2c).map((a) => a.id)).toEqual(["3"]);
  });

  it("předmět se po změně třídy vrátí na Všechny, když v nabídce není", () => {
    const optsB = subjectOptions(list.filter((a) => assignmentInScope(a, classScope("B"), g2c)));
    expect(keepSubject("Hygiena", optsB)).toBe(ALL_SCOPE);
    expect(keepSubject("Matematika", optsB)).toBe("Matematika");
  });
});

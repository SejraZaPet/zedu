import { describe, it, expect } from "vitest";
import {
  ALL_SCOPE, NO_SUBJECT, classScope, groupScope, groupsFullyInClass,
  filterAssignments, subjectOptions, keepSubject, assignmentInScope, courseSubjectOptions, statusCounts, ALL_STATUS,
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
  { id: "1", class_id: "A", group_id: null, subject_id: "gas", subject: "Gastronomie", status: "published" },
  { id: "2", class_id: "A", group_id: null, subject: null, status: "scheduled" },
  { id: "3", class_id: null, group_id: "gA", subject_id: "hyg", subject: "Hygiena", status: "published" },
  { id: "4", class_id: null, group_id: "gMix", subject_id: "gas", subject: "Gastronomie", status: "draft" },
  { id: "5", class_id: "B", group_id: null, subject_id: "mat", subject: "Matematika", status: "published" },
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
      { value: "id:gas", label: "Gastronomie" },
      { value: "id:hyg", label: "Hygiena" },
      { value: NO_SUBJECT, label: "Bez předmětu" },
    ]);
    expect(filterAssignments(list, classScope("A"), NO_SUBJECT, g2c).map((a) => a.id)).toEqual(["2"]);
    expect(filterAssignments(list, classScope("A"), "id:hyg", g2c).map((a) => a.id)).toEqual(["3"]);
  });

  it("předmět se po změně třídy vrátí na Všechny, když v nabídce není", () => {
    const optsB = subjectOptions(list.filter((a) => assignmentInScope(a, classScope("B"), g2c)));
    expect(keepSubject("id:hyg", optsB)).toBe(ALL_SCOPE);
    expect(keepSubject("id:mat", optsB)).toBe("id:mat");
  });

  it("kombinuje třídu, předmět a stav", () => {
    expect(filterAssignments(list, classScope("A"), "id:hyg", g2c, "published").map((a) => a.id)).toEqual(["3"]);
    expect(filterAssignments(list, classScope("A"), ALL_SCOPE, g2c, "scheduled").map((a) => a.id)).toEqual(["2"]);
    expect(filterAssignments(list, groupScope("gMix"), "id:gas", g2c, "draft").map((a) => a.id)).toEqual(["4"]);
    expect(filterAssignments(list, classScope("A"), ALL_SCOPE, g2c, ALL_STATUS)).toHaveLength(3);
  });

  it("počítá stavy v aktuálním výběru", () => {
    const selected = filterAssignments(list, classScope("A"), ALL_SCOPE, g2c);
    expect(statusCounts(selected)).toEqual({ all: 3, published: 2, scheduled: 1, draft: 0 });
  });

  it("nabídne u skupiny její předmět a u třídy rozvrh plus úkoly", () => {
    const catalog = [
      { id: "gas", name: "Gastronomie", classIds: ["A"], groupIds: ["gMix"] },
      { id: "hyg", name: "Hygiena", classIds: [], groupIds: ["gA"] },
      { id: "mat", name: "Matematika", classIds: ["B"], groupIds: [] },
    ];
    expect(courseSubjectOptions(groupScope("gA"), list, catalog, g2c)).toEqual([{ value: "id:hyg", label: "Hygiena" }]);
    expect(courseSubjectOptions(classScope("A"), list, catalog, g2c)).toEqual([
      { value: "id:gas", label: "Gastronomie" },
      { value: "id:hyg", label: "Hygiena" },
    ]);
  });
});

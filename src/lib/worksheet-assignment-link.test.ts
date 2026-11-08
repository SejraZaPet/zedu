// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hasWorksheet, sameWorksheetTarget, unpublishedWorksheet, worksheetLinkPatch, type LinkAssignment } from "./worksheet-assignment-link";
const assignment: LinkAssignment = { id: "a", title: "[TEST] Úkol", teacher_id: "teacher", subject_id: "subject", class_id: null, group_id: "group", worksheet_id: "old", settings: { notifyEmail: false, lateUntil: "date" } };
describe("přiložení listu bez změny úlohy", () => {
  it("koncept a naplánovaný list označuje jako nezveřejněné", () => {
    expect(unpublishedWorksheet("draft")).toBe(true);
    expect(unpublishedWorksheet("scheduled")).toBe(true);
    expect(unpublishedWorksheet("published")).toBe(false);
  });
  it("výběr nabízí jen vlastní úkol stejného předmětu a skupiny", () => {
    expect(sameWorksheetTarget(assignment, "teacher", "group:group", "subject")).toBe(true);
    expect(sameWorksheetTarget(assignment, "other", "group:group", "subject")).toBe(false);
    expect(sameWorksheetTarget(assignment, "teacher", "group:other", "subject")).toBe(false);
    expect(sameWorksheetTarget(assignment, "teacher", "group:group", "other")).toBe(false);
    expect(sameWorksheetTarget(assignment, "teacher", "class:group", "subject")).toBe(false);
    expect(sameWorksheetTarget({ ...assignment, settings: { kind: "announcement" } }, "teacher", "group:group", "subject")).toBe(false);
  });
  it("výběr podporuje vlastní úkol pro stejnou třídu", () => {
    expect(sameWorksheetTarget({ ...assignment, class_id: "class", group_id: null }, "teacher", "class:class", "subject")).toBe(true);
  });
  it("u úkolu mění pouze worksheet_id", () => {
    expect(worksheetLinkPatch(assignment, { id: "new", title: "[TEST] List" })).toEqual({ worksheet_id: "new" });
  });
  it("materiál zachová první list a ostatní nastavení", () => {
    const material = { ...assignment, settings: { kind: "material", notifyEmail: false, lessons: [{ id: "lesson" }], worksheets: [{ id: "old", title: "[TEST] První" }] } };
    expect(worksheetLinkPatch(material, { id: "new", title: "[TEST] Další" })).toEqual({ worksheet_id: "old", settings: { ...material.settings, worksheets: [{ id: "old", title: "[TEST] První" }, { id: "new", title: "[TEST] Další" }] } });
    expect(hasWorksheet(material, "old")).toBe(true);
  });
  it("nezduplikuje list v materiálu a najde i další list", () => {
    const material = { ...assignment, settings: { kind: "material", worksheets: [{ id: "old", title: "První" }, { id: "next", title: "Další" }] } };
    expect(hasWorksheet(material, "next")).toBe(true);
    expect(worksheetLinkPatch(material, { id: "next", title: "Další" }).settings?.worksheets).toHaveLength(2);
    expect(hasWorksheet(assignment, "next")).toBe(false);
  });
  it("oznámení neumožní připojit list", () => {
    expect(() => worksheetLinkPatch({ ...assignment, settings: { kind: "announcement" } }, { id: "new", title: "List" })).toThrow();
  });
});
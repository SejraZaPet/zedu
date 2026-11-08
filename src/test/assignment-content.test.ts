import { describe, it, expect } from "vitest";
import { addLesson, applyLessonsToSettings, assignmentLessons, lessonCountLabel, lessonFieldsForSave, moveLesson, removeLesson, assignmentWorksheets, addWorksheet, removeWorksheet, moveWorksheet, worksheetFieldsForSave, applyWorksheetsToSettings } from "@/lib/assignment-content";
import type { PlanLesson } from "@/lib/planned-assignment";

const A: PlanLesson = { id: "a", source: "teacher_textbook_lessons", title: "A" };
const B: PlanLesson = { id: "b", source: "textbook_lessons", title: "B" };
const C: PlanLesson = { id: "c", source: "teacher_textbook_lessons", title: "C" };

describe("material worksheets", () => {
  const a = { id: "a", title: "A" }, b = { id: "b", title: "B" };
  it("legacy worksheet is the first entry without modifying the record", () => {
    const row = { worksheet_id: "a", settings: { kind: "material", worksheets: [b] } };
    expect(assignmentWorksheets(row).map((w) => w.id)).toEqual(["a", "b"]);
    expect(row.settings.worksheets).toEqual([b]);
  });
  it("supports an uncapped ordered list and deduplicates additions", () => {
    const list = Array.from({ length: 100 }, (_, i) => ({ id: `${i}`, title: `${i}` }));
    expect(addWorksheet(list, a)).toHaveLength(101);
    expect(addWorksheet([a], a)).toEqual([a]);
  });
  it("reorders and removes without reintroducing the original primary", () => {
    const list = removeWorksheet(moveWorksheet([a, b], 1, -1), "a");
    expect(list).toEqual([b]);
    expect(worksheetFieldsForSave("material", list, "a").worksheet_id).toBe("b");
    expect(worksheetFieldsForSave("material", [], "a").worksheet_id).toBeNull();
  });
  it("saves exactly id/title in material settings and the first primary", () => {
    expect(applyWorksheetsToSettings({ kind: "material", notifyEmail: false }, "material", [b, a])).toEqual({ kind: "material", notifyEmail: false, worksheets: [b, a] });
    expect(worksheetFieldsForSave("material", [b, a], "a")).toEqual({ worksheet_id: "b" });
  });
  it("tasks retain only their original single worksheet", () => {
    expect(worksheetFieldsForSave("task", [b, a], "a")).toEqual({ worksheet_id: "a" });
    expect(assignmentWorksheets({ worksheet_id: "a", settings: { worksheets: [b] } }).map((w) => w.id)).toEqual(["a"]);
    expect(applyWorksheetsToSettings({ worksheets: [b], custom: true }, "task", [a])).toEqual({ custom: true });
  });
  it("announcements never save a material list", () => {
    expect(applyWorksheetsToSettings({ kind: "announcement", worksheets: [b] }, "announcement", [a])).toEqual({ kind: "announcement" });
  });
  it("empty material removes the list key", () => {
    expect(applyWorksheetsToSettings({ kind: "material", worksheets: [a] }, "material", [])).toEqual({ kind: "material" });
  });
});

describe("více lekcí u materiálu", () => {
  it("starý záznam s jednou lekcí čte z lesson_id", () => {
    expect(assignmentLessons({ lesson_id: "x", lesson_source: "textbook_lessons", settings: { kind: "material" } }))
      .toEqual([{ id: "x", source: "textbook_lessons", title: "Lekce" }]);
  });
  it("nový záznam čte settings.lessons v pořadí", () => {
    expect(assignmentLessons({ lesson_id: "b", settings: { kind: "material", lessons: [B, A] } }).map((l) => l.id)).toEqual(["b", "a"]);
  });
  it("přidání nezduplikuje lekci", () => {
    expect(addLesson([A], A)).toEqual([A]);
    expect(addLesson([A], B)).toEqual([A, B]);
  });
  it("řazení šipkami a meze", () => {
    expect(moveLesson([A, B, C], 2, -1).map((l) => l.id)).toEqual(["a", "c", "b"]);
    expect(moveLesson([A, B], 0, -1)).toEqual([A, B]);
    expect(moveLesson([A, B], 1, 1)).toEqual([A, B]);
  });
  it("odebrání", () => {
    expect(removeLesson([A, B, C], "b").map((l) => l.id)).toEqual(["a", "c"]);
  });
  it("materiál ukládá první lekci do lesson_id a celé pořadí do settings", () => {
    const f = lessonFieldsForSave("material", [B, A], { id: "", source: null });
    expect(f.lesson_id).toBe("b");
    expect(f.lesson_source).toBe("textbook_lessons");
    expect(applyLessonsToSettings({ kind: "material" }, f.lessons, false).lessons).toEqual([B, A]);
  });
  it("materiál s jednou lekcí vypadá jako dřív (bez settings.lessons)", () => {
    const f = lessonFieldsForSave("material", [A], { id: "", source: null });
    expect(f.lesson_id).toBe("a");
    expect(applyLessonsToSettings({ kind: "material", lessons: [A, B] }, f.lessons, false)).toEqual({ kind: "material" });
  });
  it("úkol zůstává s jednou lekcí z formuláře", () => {
    const f = lessonFieldsForSave("task", [A, B], { id: "z", source: "teacher_textbook_lessons" });
    expect(f.lesson_id).toBe("z");
    expect(f.lesson_source).toBe("teacher_textbook_lessons");
    expect(applyLessonsToSettings({}, f.lessons, false)).toEqual({});
  });
  it("plán si settings.lessons ponechá", () => {
    expect(applyLessonsToSettings({ plan: true, lessons: [A] }, "remove", true)).toEqual({ plan: true, lessons: [A] });
  });
  it("popisek počtu", () => {
    expect(lessonCountLabel(1)).toBe("1 lekce");
    expect(lessonCountLabel(2)).toBe("2 lekce");
    expect(lessonCountLabel(5)).toBe("5 lekcí");
  });
});

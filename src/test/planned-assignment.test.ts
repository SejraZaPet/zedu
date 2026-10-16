import { describe, it, expect } from "vitest";
import { buildPlanInsert, isPlanWithoutContent, parsePlanTarget, planLessons, upcomingForSubject, validatePlanForm, type PlanForm } from "@/lib/planned-assignment";
import { reminderBody, reminderMemberSource } from "../../supabase/functions/_shared/reminder-targets";

const NOW = new Date(2026, 9, 16, 12, 0);
const form = (p: Partial<PlanForm> = {}): PlanForm => ({ target: "class:c1", subjectId: "s1", kind: "test", title: "Test zlomky", date: "2026-10-20", time: "08:00", note: "", lessons: [], ...p });

describe("plán testu pro třídu nebo skupinu", () => {
  it("cíl je třída XOR skupina", () => {
    expect(parsePlanTarget("class:c1")).toEqual({ class_id: "c1", group_id: null });
    expect(parsePlanTarget("group:g1")).toEqual({ class_id: null, group_id: "g1" });
    expect(parsePlanTarget("")).toBeNull();
    expect(parsePlanTarget("class:")).toBeNull();
  });
  it("validace: cíl, název, termín v budoucnosti", () => {
    expect(validatePlanForm(form(), NOW)).toEqual([]);
    expect(validatePlanForm(form({ target: "" }), NOW)).toContain("Vyberte třídu nebo skupinu.");
    expect(validatePlanForm(form({ title: "  " }), NOW)).toContain("Zadejte název.");
    expect(validatePlanForm(form({ date: "" }), NOW)).toContain("Zadejte termín.");
    expect(validatePlanForm(form({ date: "2026-10-15" }), NOW)).toContain("Termín musí být v budoucnosti.");
  });
  it("uloží se jako zveřejněná úloha bez obsahu se settings.lessons", () => {
    const l = [{ id: "L1", source: "textbook_lessons" as const, title: "A" }, { id: "L2", source: "teacher_textbook_lessons" as const, title: "B" }, { id: "L1", source: "textbook_lessons" as const, title: "A" }];
    const row = buildPlanInsert(form({ target: "group:g1", kind: "pisemka", lessons: l }), "t1");
    expect(row).toMatchObject({ status: "published", class_id: null, group_id: "g1", subject_id: "s1", exam_type: "pisemne", activity_data: [], lesson_id: "L1", lesson_source: "textbook_lessons" });
    expect(row.settings).toEqual({ plan: true, lessons: l.slice(0, 2) });
    expect(buildPlanInsert(form({ kind: "ukol" }), "t1").exam_type).toBeNull();
  });
  it("plán bez obsahu se pozná; po připojení obsahu už ne", () => {
    const base = { settings: { plan: true }, activity_data: [] };
    expect(isPlanWithoutContent(base)).toBe(true);
    expect(isPlanWithoutContent({ ...base, worksheet_id: "w" })).toBe(false);
    expect(isPlanWithoutContent({ ...base, activity_data: [{}] })).toBe(false);
    expect(isPlanWithoutContent({ activity_data: [] })).toBe(false);
  });
  it("lekce plánu s fallbackem na lesson_id", () => {
    expect(planLessons({ lesson_id: "X", lesson_source: "textbook_lessons" })).toEqual([{ id: "X", source: "textbook_lessons", title: "Lekce" }]);
    expect(planLessons({ settings: { lessons: [null, { id: "Y", title: "Y" }] } })).toEqual([{ id: "Y", source: "teacher_textbook_lessons", title: "Y" }]);
    expect(planLessons(null)).toEqual([]);
  });
  it("Co nás čeká: dnešní a budoucí termíny vzestupně, bez termínu a minulé ne", () => {
    const items = [
      { id: "a", deadline: "2026-10-25T08:00:00" }, { id: "b", deadline: null }, { id: "c", deadline: "2026-10-16T07:00:00" },
      { id: "d", deadline: "2026-10-10T08:00:00" }, { id: "e", deadline: "2026-10-18T08:00:00" }, { id: "f", deadline: "nesmysl" },
    ];
    expect(upcomingForSubject(items, NOW).map((x) => x.id)).toEqual(["c", "e", "a"]);
    expect(upcomingForSubject(items, NOW, 1).map((x) => x.id)).toEqual(["c"]);
  });
  it("připomínky: skupina bere členy skupiny, třída členy třídy", () => {
    expect(reminderMemberSource({ group_id: "g", deadline: "x" })).toMatchObject({ table: "subject_group_members", userColumn: "student_id", id: "g" });
    expect(reminderMemberSource({ class_id: "c", deadline: "x" })).toMatchObject({ table: "class_members", userColumn: "user_id", id: "c" });
    expect(reminderMemberSource({ deadline: "x" })).toBeNull();
    expect(reminderMemberSource({ group_id: "g", deadline: null })).toBeNull();
    expect(reminderBody({ title: "T", settings: { plan: true }, activity_data: [] }, "1. 1.")).toContain("Připrav se");
    expect(reminderBody({ title: "T" }, "1. 1.")).toContain("Odevzdej");
  });
});

// @vitest-environment node
import { describe, expect, it } from "vitest";
import { KIND_FIELDS, kindHas, neutralizeForKind, submittableOnly, canChangeKind, assignmentKind, KIND_TEXT } from "@/lib/assignment-kind";

const taskRow = {
  deadline: "2026-12-01T10:00:00Z", max_attempts: 3, exam_type: "test", group_mode: "groups", group_size: 4,
  randomize_order: true, randomize_choices: true, is_portfolio_task: true, lockdown_mode: true,
  worksheet_id: "w1", lesson_id: "l1", lesson_source: "teacher",
};

describe("KIND_FIELDS", () => {
  it("material has no task fields but keeps worksheet and lesson", () => {
    for (const f of ["deadline", "attempts", "late", "examType", "groupMode", "randomize", "portfolio", "lockdown", "cheatsheet", "notifyOverdue", "targetDeadline", "submission"] as const)
      expect(kindHas("material", f)).toBe(false);
    expect(kindHas("material", "worksheet")).toBe(true);
    expect(kindHas("material", "lesson")).toBe(true);
  });
  it("announcement has only pinned and visibleUntil", () => {
    expect([...KIND_FIELDS.announcement].sort()).toEqual(["pinned", "visibleUntil"]);
  });
  it("task keeps deadline, attempts and exam type", () => {
    expect(kindHas("task", "deadline") && kindHas("task", "attempts") && kindHas("task", "examType")).toBe(true);
  });
});

describe("neutralizeForKind", () => {
  it("material gets neutral values, keeps worksheet and lesson", () => {
    expect(neutralizeForKind("material", taskRow)).toEqual({
      deadline: null, max_attempts: 1, exam_type: null, group_mode: "individual", group_size: null,
      randomize_order: false, randomize_choices: false, is_portfolio_task: false, lockdown_mode: false,
      worksheet_id: "w1", lesson_id: "l1", lesson_source: "teacher",
    });
  });
  it("announcement also drops worksheet and lesson", () => {
    const r = neutralizeForKind("announcement", taskRow);
    expect(r.worksheet_id).toBeNull();
    expect(r.lesson_id).toBeNull();
    expect(r.exam_type).toBeNull();
  });
  it("switching task → material → task does not mutate form values; only the saved row is neutral", () => {
    const form = { ...taskRow };
    const saved = neutralizeForKind("material", form);
    expect(saved.max_attempts).toBe(1);
    expect(form.max_attempts).toBe(3);
    expect(neutralizeForKind("task", form)).toEqual(taskRow);
  });
});

describe("filters and legacy", () => {
  it("results keep only tasks; legacy row without kind counts as task", () => {
    const rows = [{ id: "a", settings: null }, { id: "b", settings: { kind: "material" } }, { id: "c", settings: { kind: "announcement" } }, { id: "d", settings: { kind: "task" } }];
    expect(submittableOnly(rows).map((r) => r.id)).toEqual(["a", "d"]);
    expect(assignmentKind({})).toBe("task");
  });
  it("kind change is blocked once there are attempts", () => {
    expect(canChangeKind(true)).toBe(false);
    expect(canChangeKind(false)).toBe(true);
  });
  it("titles follow the kind", () => {
    expect(KIND_TEXT.material.create).toBe("Nový materiál");
    expect(KIND_TEXT.announcement.edit).toBe("Upravit oznámení");
  });
});

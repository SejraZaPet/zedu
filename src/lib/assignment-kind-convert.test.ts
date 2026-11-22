import { describe, it, expect } from "vitest";
import { toMaterialPatch, toTaskPatch, canRevertToTask, impactText } from "./assignment-kind-convert";
import { submittableOnly } from "./assignment-kind";

const task = {
  id: "a1", worksheet_id: "w1", deadline: "2026-11-29T19:00:00.000Z", max_attempts: 3, exam_type: "test",
  group_mode: "individual", group_size: null, randomize_order: true, randomize_choices: false,
  is_portfolio_task: false, lockdown_mode: false, lesson_id: "l1", lesson_source: "teacher_textbook_lessons",
  settings: { lateUntil: "unlimited", notifyOverdue: true, commentsEnabled: true, plan: { x: 1 } },
};

describe("převod úkol ↔ materiál", () => {
  it("převod na materiál zachová ostatní settings a doplní list", () => {
    const p = toMaterialPatch(task);
    expect(p.settings.kind).toBe("material");
    expect(p.settings.commentsEnabled).toBe(true);
    expect(p.settings.plan).toEqual({ x: 1 });
    expect(p.settings.worksheets).toEqual([{ id: "w1" }]);
    expect(p.settings.lateUntil).toBeUndefined();
    expect(p.deadline).toBeNull();
    expect(p.worksheet_id).toBe("w1");
    expect(p.lesson_id).toBe("l1");
    expect((p.settings.previousTask as any).row.deadline).toBe("2026-11-29T19:00:00.000Z");
  });
  it("patch nikdy nemění pokusy ani stav zveřejnění", () => {
    const p = toMaterialPatch(task);
    expect(Object.keys(p)).not.toContain("status");
    expect(Object.keys(p)).not.toContain("attempts");
  });
  it("vrácení obnoví termín, nastavení i worksheet_id", () => {
    const mat = { ...task, ...toMaterialPatch(task), id: "a1", worksheet_id: null };
    expect(canRevertToTask(mat.settings)).toBe(true);
    const back = toTaskPatch(mat as any);
    expect(back.deadline).toBe("2026-11-29T19:00:00.000Z");
    expect(back.max_attempts).toBe(3);
    expect(back.exam_type).toBe("test");
    expect(back.worksheet_id).toBe("w1");
    expect(back.settings.kind).toBeUndefined();
    expect(back.settings.previousTask).toBeUndefined();
    expect(back.settings.lateUntil).toBe("unlimited");
    expect(back.settings.commentsEnabled).toBe(true);
  });
  it("materiál vypadne ze submittableOnly a po vrácení se vrátí", () => {
    const mat = { ...task, ...toMaterialPatch(task) };
    expect(submittableOnly([mat])).toHaveLength(0);
    const back = { ...mat, ...toTaskPatch(mat as any) };
    expect(submittableOnly([back])).toHaveLength(1);
  });
  it("souhrn dopadu", () => expect(impactText(21, 15)).toBe("21 odevzdání a 15 hodnocení zmizí z výsledků a z fronty hodnocení, nic se nesmaže, jde vrátit zpět."));
});

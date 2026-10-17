import { describe, expect, it } from "vitest";
import { gameTemplateCopy, type GameTemplate } from "@/lib/game-templates";

describe("demo template copy", () => {
  it("preserves content and owner but removes seed identity", () => {
    const template = { id: "source", teacher_id: "teacher-a", title: "Ukázka: Kvíz", activity_data: [{ type: "activity" }], demo_pair_id: "pair-a", demo_seed_key: "quiz", created_at: "today", updated_at: "today" } as GameTemplate;
    const copy = gameTemplateCopy(template);
    expect(copy.teacher_id).toBe("teacher-a");
    expect(copy.activity_data).toEqual(template.activity_data);
    expect(copy).not.toHaveProperty("id");
    expect(copy).not.toHaveProperty("demo_pair_id");
    expect(copy).not.toHaveProperty("demo_seed_key");
  });
});
import { describe, it, expect } from "vitest";
import { canPublishToMaterialsOnly, materialsOnlyPublishPatch, PUBLISH_MATERIALS_ONLY_TOAST } from "./worksheet-publish-menu";

describe("publikace listu jen do materiálů", () => {
  it("nabízí se jen u konceptu", () => {
    expect(canPublishToMaterialsOnly("draft")).toBe(true);
    expect(canPublishToMaterialsOnly("published")).toBe(false);
    expect(canPublishToMaterialsOnly("scheduled")).toBe(false);
  });
  it("mění jen stav, bez úkolu a příjemců", () => {
    expect(materialsOnlyPublishPatch()).toEqual({ status: "published", scheduled_publish_at: null });
  });
  it("toast říká, že nic nebylo zadáno", () => {
    expect(PUBLISH_MATERIALS_ONLY_TOAST).toBe("Publikováno do materiálů – žákům nebylo nic zadáno");
  });
});

import { materialsOnlyDecision } from "./worksheet-publish-menu";
describe("materialsOnlyDecision – všechny kombinace", () => {
  const statuses = ["draft", "published", "scheduled"];
  const shows = [true, false];
  const lessons = ["l1", null];
  const plans: (boolean | null)[] = [true, false, null];
  for (const status of statuses) for (const show of shows) for (const lesson of lessons) for (const plan of plans) {
    it(`${status} show=${show} lesson=${lesson} plan=${plan}`, () => {
      const r = materialsOnlyDecision({ status, show_in_lesson: show, source_lesson_id: lesson, inVisiblePlan: plan });
      const inLesson = show && !!lesson;
      let expected: string | null;
      if (status !== "draft") expected = "not_draft";
      else if (inLesson && plan === true) expected = "in_lesson_and_plan";
      else if (inLesson) expected = "in_lesson";
      else if (plan === true) expected = "in_plan";
      else if (plan === null) expected = "unknown";
      else expected = null;
      expect(r).toEqual({ allowed: expected === null, reason: expected });
    });
  }
  it("konkrétně: koncept bez lekce a mimo plán je povolen", () => {
    expect(materialsOnlyDecision({ status: "draft", show_in_lesson: true, source_lesson_id: null, inVisiblePlan: false }).allowed).toBe(true);
  });
  it("chyba dotazu = nenabízet", () => {
    expect(materialsOnlyDecision({ status: "draft", show_in_lesson: false, source_lesson_id: null, inVisiblePlan: null }).allowed).toBe(false);
  });
});

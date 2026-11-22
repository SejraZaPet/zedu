import { describe, expect, it } from "vitest";
import { ACTIVITY_CATALOG_GROUPS, ACTIVITY_CATALOG_PRESETS } from "@/lib/activity-catalog";
import { STEP_TYPES } from "@/lib/studio-step";

 describe("katalog aktivit prezentace", () => {
  it("má schválených pět skupin a všechny interaktivní typy Studia", () => {
    expect(ACTIVITY_CATALOG_GROUPS.map((group) => group.label)).toEqual(["Otázky", "Procvičování", "Obrázky", "Zapojení třídy", "Skupiny a zážitek"]);
    const ids = new Set(ACTIVITY_CATALOG_PRESETS.map((preset) => preset.id));
    for (const type of STEP_TYPES.filter((item) => !["explain", "slide"].includes(item.id))) expect(ids.has(type.id as any)).toBe(true);
  });

  it("každý typ vytvoří slide s vlastním ID a aktivitou", () => {
    for (const preset of ACTIVITY_CATALOG_PRESETS) {
      const slide = preset.build();
      expect(slide.slideId).toBeTruthy();
      expect(slide.type).toBe("activity");
      expect(slide.activitySpec.activityType).toBeTruthy();
    }
  });
});

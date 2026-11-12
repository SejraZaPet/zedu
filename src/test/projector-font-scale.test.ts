import { beforeEach, describe, expect, it } from "vitest";
import {
  clampProjectorFontScale,
  combinedProjectorFontScale,
  loadProjectorFontScale,
  PROJECTOR_FONT_SCALE_KEY,
  saveProjectorFontScale,
  settingsWithProjectorFontScale,
} from "@/lib/projector-font-scale";

describe("velikost písma projekce", () => {
  beforeEach(() => localStorage.clear());

  it("používá rozsah 80–160 % po 10 % a výchozích 100 %", () => {
    expect(clampProjectorFontScale(20)).toBe(80);
    expect(clampProjectorFontScale(175)).toBe(160);
    expect(clampProjectorFontScale(126)).toBe(130);
    expect(clampProjectorFontScale("neplatné")).toBe(100);
  });

  it("ukládá a znovu načítá hodnotu pod klíčem bezli.projectorFontScale", () => {
    expect(saveProjectorFontScale(140)).toBe(140);
    expect(localStorage.getItem(PROJECTOR_FONT_SCALE_KEY)).toBe("140");
    expect(loadProjectorFontScale()).toBe(140);
  });

  it("přenáší hodnotu v settings bez přepsání ostatních pravidel relace", () => {
    const settings = { activityStartMode: "manual", armedQuestion: 4, timePerQuestion: 30 };
    expect(settingsWithProjectorFontScale(settings, 120)).toEqual({
      ...settings,
      projectorFontScale: 120,
    });
    expect(settings).not.toHaveProperty("projectorFontScale");
  });

  it("násobí velikost snímku velikostí projekce", () => {
    expect(combinedProjectorFontScale(1.25, 120)).toBeCloseTo(1.5);
    expect(combinedProjectorFontScale(undefined, 80)).toBeCloseTo(0.8);
  });
});

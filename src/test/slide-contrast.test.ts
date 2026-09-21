import { describe, expect, it } from "vitest";
import {
  cssColorLightness,
  headlineColorsForBackground,
  resolveSlideIsDark,
  slideBackgroundIsLight,
} from "@/lib/slide-contrast";
import { blockBackgroundSlideColor } from "@/lib/block-backgrounds";

describe("kontrast snímku", () => {
  it("změří světlost hex i hsl barvy", () => {
    expect(cssColorLightness("#ffffff")).toBeCloseTo(1, 2);
    expect(cssColorLightness("#000")).toBeCloseTo(0, 2);
    expect(cssColorLightness("hsl(205, 100%, 96%)")).toBeCloseTo(0.96, 2);
    expect(cssColorLightness("nope")).toBeNull();
  });

  it("pastelové pozadí bloku lekce je světlé", () => {
    const color = blockBackgroundSlideColor({ backgroundStyle: "note" });
    expect(slideBackgroundIsLight({ backgroundOverride: { color } })).toBe(true);
  });

  it("světlé pozadí přebije tmavý motiv (tmavý text)", () => {
    const slide = { backgroundOverride: { color: "hsl(34, 100%, 95%)" } };
    expect(resolveSlideIsDark(slide, true)).toBe(false);
  });

  it("tmavé vlastní pozadí si vynutí světlý text", () => {
    expect(resolveSlideIsDark({ backgroundOverride: { color: "#0F172A" } }, false)).toBe(true);
  });

  it("bez vlastního pozadí rozhoduje motiv", () => {
    expect(resolveSlideIsDark({}, true)).toBe(true);
    expect(resolveSlideIsDark({}, false)).toBe(false);
  });

  it("nadpis na světlém pozadí dostane tmavé barvy", () => {
    const c = headlineColorsForBackground("#6EC6D9", "#9B6CFF", false);
    expect(c.primary).toBe("#0F172A");
  });

  it("nadpis na tmavém pozadí se nezmění, když má motiv světlé akcenty", () => {
    const c = headlineColorsForBackground("#6EC6D9", "#9B6CFF", true);
    expect(c.primary).toBe("#6EC6D9");
  });
});

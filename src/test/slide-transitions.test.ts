import { describe, expect, it } from "vitest";
import {
  applyTransitionToSlide,
  applyTransitionToSlides,
  DEFAULT_TRANSITION,
  slideTransitionClass,
  slideTransitionStyle,
  transitionConfigFromSlide,
  transitionFromSlides,
} from "@/lib/slide-transitions";

const slide = (id: string, extra: Record<string, unknown> = {}) => ({ slideId: id, ...extra });

describe("přechody jednotlivých slidů", () => {
  it("starou prezentaci bez přechodů čte jako výchozí prolnutí", () => {
    expect(transitionFromSlides([slide("a"), slide("b")])).toBe(DEFAULT_TRANSITION);
    expect(transitionConfigFromSlide(slide("b"))).toEqual({ style: "fade", direction: "left", duration: 0.45 });
  });

  it("nastavení přechodu na slidu N+1 nemění ostatní slidy", () => {
    const original = [slide("a", { transitionStyle: "fade" }), slide("b"), slide("c")];
    const result = applyTransitionToSlide(original, 1, { style: "push", direction: "up", duration: 1.2 });
    expect(result[0]).toBe(original[0]);
    expect(result[2]).toBe(original[2]);
    expect(result[1]).toMatchObject({ transitionStyle: "push", transitionDirection: "up", transitionDuration: 1.2 });
  });

  it("Použít na všechny přenese styl, směr i délku na každý slide", () => {
    const result = applyTransitionToSlides([slide("a"), slide("b")], { style: "wipe", direction: "right", duration: 0.8 });
    expect(result.map((item) => [item.transitionStyle, item.transitionDirection, item.transitionDuration])).toEqual([
      ["wipe", "right", 0.8], ["wipe", "right", 0.8],
    ]);
  });

  it("Bez přechodu zruší animační třídu a délku", () => {
    expect(slideTransitionClass("cut")).toBe("");
    expect(slideTransitionStyle({ style: "cut", direction: "left", duration: 2 })).toEqual({});
  });

  it("posun a odkrytí respektují zvolený směr", () => {
    expect(slideTransitionClass("push", "down")).toBe("slide-trans-push slide-trans-dir-down");
    expect(slideTransitionClass("wipe", "right")).toBe("slide-trans-wipe slide-trans-dir-right");
  });

  it("délku omezí na bezpečný rozsah 0,2 až 2 sekundy", () => {
    expect(transitionConfigFromSlide(slide("a", { transitionDuration: 9 })).duration).toBe(2);
    expect(transitionConfigFromSlide(slide("a", { transitionDuration: 0 })).duration).toBe(0.2);
    expect(slideTransitionStyle({ style: "fade", direction: "left", duration: 1.1 })).toEqual({ animationDuration: "1.1s" });
  });
});

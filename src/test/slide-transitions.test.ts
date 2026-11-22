import { describe, expect, it } from "vitest";
import {
  applyTransitionToSlide,
  applyTransitionToSlides,
  DEFAULT_TRANSITION,
  slideTransitionClass,
  slideTransitionStyle,
  transitionConfigFromSlide,
  transitionFromSlides,
  SLIDE_TRANSITIONS,
  slideTransitionMatchKey,
} from "@/lib/slide-transitions";

const slide = (id: string, extra: Record<string, unknown> = {}) => ({ slideId: id, ...extra });

describe("přechody jednotlivých slidů", () => {
  it("nabízí přesně deset Canva přechodů v domluveném pořadí", () => {
    expect(SLIDE_TRANSITIONS.map((item) => [item.value, item.label])).toEqual([
      ["cut", "Žádný"], ["fade", "Rozpuštění"], ["push", "Posunutí"],
      ["circle-wipe", "Kruhové stírání"], ["color-wipe", "Stírání barev"],
      ["line-wipe", "Čárové stírání"], ["match-move", "Porovnat a přesunout"],
      ["flow", "Proudění"], ["stack", "Skládání"], ["slice", "Rozseknutí"],
    ]);
  });

  it("starou prezentaci bez přechodů čte jako výchozí rozpuštění", () => {
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
    const result = applyTransitionToSlides([slide("a"), slide("b")], { style: "line-wipe", direction: "right", duration: 0.8 });
    expect(result.map((item) => [item.transitionStyle, item.transitionDirection, item.transitionDuration])).toEqual([
      ["line-wipe", "right", 0.8], ["line-wipe", "right", 0.8],
    ]);
  });

  it("zachová původní cut/fade/push a dřívější wipe převede na čárové stírání", () => {
    expect(transitionConfigFromSlide(slide("a", { transitionStyle: "cut" })).style).toBe("cut");
    expect(transitionConfigFromSlide(slide("a", { transitionStyle: "fade" })).style).toBe("fade");
    expect(transitionConfigFromSlide(slide("a", { transitionStyle: "push" })).style).toBe("push");
    expect(transitionConfigFromSlide(slide("a", { transitionStyle: "wipe" })).style).toBe("line-wipe");
    expect(transitionFromSlides([slide("a", { transitionStyle: "blur" })])).toBe("fade");
  });

  it("Bez přechodu zruší animační třídu a délku", () => {
    expect(slideTransitionClass("cut")).toBe("");
    expect(slideTransitionStyle({ style: "cut", direction: "left", duration: 2 })).toEqual({});
  });

  it("posun respektuje zvolený směr a další efekty mají vlastní třídy", () => {
    expect(slideTransitionClass("push", "down")).toBe("slide-trans-push slide-trans-dir-down");
    expect(slideTransitionClass("line-wipe", "right")).toBe("slide-trans-line-wipe");
    expect(slideTransitionClass("circle-wipe")).toBe("slide-trans-circle-wipe");
    expect(slideTransitionClass("color-wipe")).toBe("slide-trans-color-wipe");
    expect(slideTransitionClass("match-move")).toBe("slide-trans-match-move");
    expect(slideTransitionClass("flow")).toBe("slide-trans-flow");
    expect(slideTransitionClass("stack")).toBe("slide-trans-stack");
    expect(slideTransitionClass("slice")).toBe("slide-trans-slice");
  });

  it("Match & move páruje stejný typ a název i přes odlišná interní ID", () => {
    const a = { id: "old", type: "text", props: { name: "Hlavní název", text: "Původní" } };
    const b = { id: "new", type: "text", props: { name: "Hlavní název", text: "Nový" } };
    expect(slideTransitionMatchKey(a)).toBe(slideTransitionMatchKey(b));
    expect(slideTransitionMatchKey({ ...b, type: "shape" })).not.toBe(slideTransitionMatchKey(a));
    expect(slideTransitionMatchKey({ id: "empty", type: "text", props: {} })).toBe("");
    expect(slideTransitionMatchKey({ id: "html", type: "text", props: { html: "<p>Stejný <b>text</b></p>" } })).toBe("text:Stejný text".toLocaleLowerCase("cs"));
  });

  it("délku omezí na bezpečný rozsah 0,2 až 2 sekundy", () => {
    expect(transitionConfigFromSlide(slide("a", { transitionDuration: 9 })).duration).toBe(2);
    expect(transitionConfigFromSlide(slide("a", { transitionDuration: 0 })).duration).toBe(0.2);
    expect(slideTransitionStyle({ style: "fade", direction: "left", duration: 1.1 })).toEqual({ animationDuration: "1.1s" });
  });
});

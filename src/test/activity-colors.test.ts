import { describe, it, expect } from "vitest";
import { contrastRatio, resolveActivityColors, activityColorWarnings, readActivityColors, MIN_TEXT_CONTRAST } from "@/lib/activity-colors";
import { activityMissing, presentationMissingReport } from "@/lib/activity-completeness";
import { activitySlideAppearanceStyle, getActivitySlideAppearance } from "@/lib/activity-slide-appearance";

describe("barvy aktivity a kontrast", () => {
  it("kontrast WCAG: černá/bílá 21, bílá/krémová pod 4,5", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBe(21);
    expect(contrastRatio("#FFFFFF", "#F3F1E6")).toBeLessThan(MIN_TEXT_CONTRAST);
  });
  it("bílý text na krémové kartě se zobrazí tmavě a editor varuje", () => {
    const r = resolveActivityColors({ card: "#F3F1E6", text: "#FFFFFF" });
    expect(r.text).toBe("#2B1A3F");
    expect(contrastRatio(r.text, r.card)).toBeGreaterThanOrEqual(4.5);
    expect(activityColorWarnings({ card: "#F3F1E6", text: "#FFFFFF" })[0]).toMatch(/špatně čitelný/);
  });
  it("každá kombinace palety Bezli dá čitelný text karty i odpovědí", () => {
    const pal = ["#663196", "#5D3D7F", "#63C7CF", "#F3F1E6", "#2B1A3F", "#FFFFFF"];
    for (const card of pal) for (const text of pal) for (const answer of pal) {
      const r = resolveActivityColors({ card, text, answer });
      expect(contrastRatio(r.text, r.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(r.answerText, r.answer)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("výchozí barvy jsou bez varování; neplatné hodnoty se zahodí", () => {
    expect(activityColorWarnings(undefined)).toEqual([]);
    expect(readActivityColors({ card: "red", text: "#abc" })).toEqual({ text: "#AABBCC" });
  });
  it("barvy aktivity v lekčním rendereru přepíší tokeny karty", () => {
    const st: any = activitySlideAppearanceStyle(getActivitySlideAppearance({ colors: { card: "#2B1A3F" } }));
    expect(st["--card"]).toBe("268 42% 17%");
    expect(st["--foreground"]).toBe("0 0% 100%");
  });
});

describe("co aktivitě chybí", () => {
  it("prázdný kvíz ze Studia", () => {
    expect(activityMissing({ activityType: "mcq", options: [], correctIndex: 0 })).toEqual(["otázka", "aspoň dvě vyplněné odpovědi"]);
  });
  it("kvíz se správnou odpovědí na prázdném poli", () => {
    expect(activityMissing({ activityType: "mcq", question: "Q", options: [{ text: "a" }, { text: "b" }, { text: "" }], correctIndex: 2 })).toEqual(["označená správná odpověď"]);
  });
  it("hotový kvíz je bez hlášky; souhrn uvádí číslo slidu", () => {
    expect(activityMissing({ activityType: "mcq", question: "Q", options: [{ text: "a" }, { text: "b" }], correctIndex: 1 })).toEqual([]);
    expect(presentationMissingReport([{ type: "content" }, { type: "activity", activitySpec: { activityType: "wall" } }])).toEqual(["Slide 2: chybí otázka pro žáky"]);
  });
});

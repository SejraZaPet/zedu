import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SlideBody } from "@/components/admin/SlideCanvas";
import PresentationTemplatesPanel from "@/components/presentation/PresentationTemplatesPanel";
import { BEZLI_DECK_TEMPLATES, SLIDE_TEMPLATES, insertTemplateSlidesAfter } from "@/lib/presentation-templates";
import { applyThemeToSlides, getPresentationTheme } from "@/lib/presentation-themes";
import { gradientVisibleStops } from "@/lib/slide-gradient";
import { contrastRatio, DEFAULT_ACTIVITY_COLORS, resolveActivityColors } from "@/lib/activity-colors";
import { customTemplateSlides, deleteCustomPresentationTemplate, loadCustomPresentationTemplates, saveCustomPresentationTemplate } from "@/lib/presentation-custom-templates";

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return { get length() { return values.size; }, clear: () => values.clear(), getItem: (key) => values.get(key) ?? null, key: (index) => [...values.keys()][index] ?? null, removeItem: (key) => { values.delete(key); }, setItem: (key, value) => { values.set(key, value); } };
}

describe("Etapa 5 – datové šablony", () => {
  it("má všech 11 požadovaných šablon a každá vytvoří nové upravitelné bloky", () => {
    expect(SLIDE_TEMPLATES.map((t) => t.id)).toEqual(["title", "goal", "text-image", "two-cards", "three-cards", "stats", "quote", "quiz", "summary", "closing", "break"]);
    for (const template of SLIDE_TEMPLATES) {
      const first = template.build(); const second = template.build();
      expect(first.blocks.length).toBeGreaterThan(0);
      expect(first.slideId).not.toBe(second.slideId);
      expect(first.blocks[0].id).not.toBe(second.blocks[0].id);
      expect(first.blocks.some((b: any) => ["heading", "paragraph", "activity"].includes(b.type))).toBe(true);
      expect(first.blocks.filter((b: any) => b.type === "shape").every((b: any) => ["rectangle", "rounded-rect", "pill"].includes(b.props.shapeKind))).toBe(true);
      expect(JSON.stringify(first)).not.toContain("base64,");
      const { unmount, queryByText } = render(<SlideBody slide={first} themeId={first.themeId} editable />);
      expect(queryByText("Nadpis slidu")).toBeNull(); unmount();
    }
  });

  it("vložení každé šablony zachová existující obsah i aktivitu a nemutuje vstupy", () => {
    for (const template of SLIDE_TEMPLATES) {
      const original = [{ slideId: "original", type: "activity", activitySpec: { activityType: "mcq", question: "Původní" }, blocks: [] }];
      const snapshot = structuredClone(original); const inserted = template.build(); const insertedSnapshot = structuredClone(inserted);
      const result = insertTemplateSlidesAfter(original, [inserted], 0);
      expect(result).toHaveLength(2); expect(result[0]).toEqual(snapshot[0]); expect(original).toEqual(snapshot); expect(inserted).toEqual(insertedSnapshot);
      expect(result[1].slideId).not.toBe(inserted.slideId); expect(result[1].blocks[0].id).not.toBe(inserted.blocks[0].id);
      expect(result[0].activitySpec.question).toBe("Původní");
    }
  });

  it("celé sady obsahují všechny slidy a použití motivu nemění data aktivity", () => {
    for (const deck of BEZLI_DECK_TEMPLATES) expect(deck.build().length).toBeGreaterThanOrEqual(3);
    const quiz = SLIDE_TEMPLATES.find((t) => t.id === "quiz")!.build();
    const changed = applyThemeToSlides([quiz], "bezli-dark");
    expect(changed[0].themeId).toBe("bezli-dark"); expect(changed[0].activitySpec).toEqual(quiz.activitySpec);
    expect(changed[0].activitySpec.options).toHaveLength(2); expect(changed[0].activitySpec.colors).toEqual(DEFAULT_ACTIVITY_COLORS);
  });

  it("vlastní šablony se uloží, načtou, vloží s novými ID a smažou jen podle vlastního ID", () => {
    const storage = memoryStorage(); const slide = SLIDE_TEMPLATES.find((t) => t.id === "quiz")!.build();
    const saved = saveCustomPresentationTemplate("teacher-1", "Můj kvíz", "slide", [slide], storage);
    saveCustomPresentationTemplate("teacher-1", "Celá deka", "deck", [slide, slide], storage);
    expect(loadCustomPresentationTemplates("teacher-1", storage)).toHaveLength(2);
    expect(loadCustomPresentationTemplates("teacher-2", storage)).toHaveLength(0);
    const inserted = customTemplateSlides(saved); expect(inserted[0].slideId).not.toBe(slide.slideId); expect(inserted[0].activitySpec).toEqual(slide.activitySpec);
    expect(deleteCustomPresentationTemplate("teacher-1", saved.id, storage).map((t) => t.name)).toEqual(["Celá deka"]);
  });

  it("nahrazení obsahu celou sadou vyžaduje potvrzení", () => {
    const apply = vi.fn();
    render(<PresentationTemplatesPanel userId="teacher-1" currentSlide={{ slideId: "x", blocks: [] }} allSlides={[{ slideId: "x", blocks: [] }]} hasContent themeId="minimal" onThemeChange={() => {}} onInsertSlide={() => {}} onApplyDeck={apply} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Použít pro celou prezentaci" })[0]);
    expect(apply).not.toHaveBeenCalled(); expect(screen.getByText("Nahradit aktuální prezentaci?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ano, použít šablonu" })); expect(apply).toHaveBeenCalledTimes(1);
  });
});

describe("Etapa 5 – kontrast motivů a aktivit", () => {
  it("nové gradienty mají bílý text s kontrastem aspoň 4,5:1 na každém viditelém bodu", () => {
    for (const id of ["bezli-gradient", "bezli-dark"]) {
      const theme = getPresentationTheme(id); const stops = gradientVisibleStops(theme.gradient);
      expect(stops.length).toBeGreaterThanOrEqual(2);
      for (const stop of stops) expect(contrastRatio("#FFFFFF", stop)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("světlý motiv a krémový pruh mají kontrastní text a karty aktivit se nemění", () => {
    expect(contrastRatio("#2B1A3F", getPresentationTheme("bezli-cream").backgroundStyle)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#2B1A3F", getPresentationTheme("bezli-cream-band").footerBandColor!)).toBeGreaterThanOrEqual(4.5);
    const activity = resolveActivityColors(DEFAULT_ACTIVITY_COLORS);
    expect(contrastRatio(activity.text, activity.card)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(activity.answerText, activity.answer)).toBeGreaterThanOrEqual(4.5);
  });
});

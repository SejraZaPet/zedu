import { describe, expect, it } from "vitest";
import {
  WIZARD_TYPES, isSupported, clampItemCount, limitSourceText, resolveSource,
  buildAiRequest, buildBlock, SOURCE_TEXT_LIMIT,
} from "@/lib/activity-wizard";

const s = { itemCount: 8, difficulty: "medium" as const, optionCount: 3, wordBank: false };
const longText = "Poživatiny jsou látky určené k výživě člověka. ".repeat(5);

describe("activity wizard – přiřazení typu", () => {
  it("podporuje jen typy, které editor lekce umí", () => {
    const supported = Object.keys(WIZARD_TYPES).filter(isSupported).sort();
    expect(supported).toEqual(["fillblanks", "flashcards", "imagelabel", "matching", "ordering", "quiz", "summary", "truefalse"]);
    expect(isSupported("open")).toBe(false);
    expect(isSupported("table")).toBe(false);
    expect(isSupported("neznamy")).toBe(false);
    expect(WIZARD_TYPES.fillblanks.activityType).toBe("fill_blanks");
    expect(WIZARD_TYPES.summary.blockType).toBe("summary");
    expect(WIZARD_TYPES.quiz.liveGame).toBe(true);
  });
});

describe("activity wizard – výběr zdroje", () => {
  it("prázdná nevolá AI", () => expect(resolveSource({ mode: "empty" })).toEqual({ kind: "empty" }));
  it("z lekce vyžaduje lekci a dost textu, čte vnořené props", () => {
    expect(resolveSource({ mode: "lesson", lessons: [] }).kind).toBe("error");
    expect(resolveSource({ mode: "lesson", lessons: [{ title: "A", blocks: [] }] }).kind).toBe("error");
    const r = resolveSource({ mode: "lesson", lessons: [
      { title: "L1", blocks: [{ type: "slide_group", props: { children: [{ props: { text: `<p>${longText}</p>` } }] } }] },
      { title: "L2", blocks: [{ props: { text: "Druhá lekce" } }] },
    ] });
    expect(r.kind).toBe("ai");
    if (r.kind === "ai") { expect(r.text).toContain("Druhá lekce"); expect(r.text).not.toContain("<p>"); }
  });
  it("vložený text: krátký odmítne, dlouhý ořízne", () => {
    expect(resolveSource({ mode: "text", text: "krátké" }).kind).toBe("error");
    const r = resolveSource({ mode: "text", text: "x".repeat(SOURCE_TEXT_LIMIT + 500) });
    expect(r.kind === "ai" && r.text.length).toBe(SOURCE_TEXT_LIMIT);
  });
});

describe("activity wizard – omezení a sestavení", () => {
  it("počet položek je 4–12", () => {
    expect(clampItemCount(1)).toBe(4);
    expect(clampItemCount(50)).toBe(12);
    expect(clampItemCount("abc")).toBe(8);
    expect(limitSourceText("  ab  ", 1)).toBe("a");
  });
  it("request kvízu nese počet otázek (max 10) a možností", () => {
    const req = buildAiRequest("quiz", "Kvíz", "text", { ...s, itemCount: 12 });
    expect(req).toMatchObject({ activityType: "quiz", itemCount: 12, questionCount: 10, optionCount: 3 });
    expect(buildAiRequest("flashcards", "K", "t", s)).toMatchObject({ cardCount: 8 });
  });
  it("blok z AI je označen, prázdný ne; doplňovačka nese banku slov", () => {
    const ai = buildBlock("fillblanks", { fillBlanks: { text: "A {{b}}" } }, s, "D");
    expect(ai.props.ai_generated).toBe(true);
    expect(ai.props.fillBlanks.showWordBank).toBe(false);
    const empty = buildBlock("quiz", null, s, "Q");
    expect(empty.props.ai_generated).toBeUndefined();
    expect(empty.props.activityType).toBe("quiz");
    expect(buildBlock("summary", { summary: { text: "<ul><li>x</li></ul>" } }, s, "S").type).toBe("summary");
    expect(() => buildBlock("table", null, s, "T")).toThrow();
  });
});

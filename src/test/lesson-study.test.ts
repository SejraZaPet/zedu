import { describe, it, expect } from "vitest";
import {
  blocksToPlainText,
  extractCardsFromBlocks,
  pickStudyMethod,
  LESSON_TEXT_MAX,
} from "@/lib/lesson-study";

describe("blocksToPlainText", () => {
  it("vytáhne text z bloků a ignoruje prázdné vstupy", () => {
    expect(blocksToPlainText(null)).toBe("");
    expect(blocksToPlainText([])).toBe("");
    const blocks = [
      { type: "text", props: { text: "První odstavec" } },
      { type: "heading", props: { heading: "Nadpis" } },
      { type: "image", props: { url: "x.png" } },
    ];
    const text = blocksToPlainText(blocks);
    expect(text).toContain("První odstavec");
    expect(text).toContain("Nadpis");
  });

  it("omezí délku na maximum", () => {
    const blocks = [{ type: "text", props: { text: "a".repeat(LESSON_TEXT_MAX + 500) } }];
    expect(blocksToPlainText(blocks).length).toBeLessThanOrEqual(LESSON_TEXT_MAX);
  });
});

describe("extractCardsFromBlocks", () => {
  it("najde kartičky z aktivit flashcards a reveal_cards", () => {
    const blocks = [
      {
        type: "activity",
        props: {
          activityType: "flashcards",
          flashcards: [
            { front: "Fotosyntéza", back: "Proces výroby organických látek" },
            { front: "", back: "prázdná přední – přeskočit" },
          ],
        },
      },
      {
        type: "activity",
        props: {
          activityType: "reveal_cards",
          revealCards: { cards: [{ title: "Buněčná stěna", content: "Chrání buňku" }] },
        },
      },
      { type: "activity", props: { activityType: "quiz", quiz: {} } },
    ];
    const cards = extractCardsFromBlocks(blocks);
    expect(cards).toHaveLength(2);
    expect(cards[0]).toEqual({ front: "Fotosyntéza", back: "Proces výroby organických látek" });
    expect(cards[1]).toEqual({ front: "Buněčná stěna", back: "Chrání buňku" });
  });

  it("bez karet vrátí prázdné pole (spustí se AI)", () => {
    expect(extractCardsFromBlocks([{ type: "text", props: { text: "jen text" } }])).toEqual([]);
    expect(extractCardsFromBlocks(undefined)).toEqual([]);
  });
});

describe("pickStudyMethod", () => {
  const methods = [
    { id: "m1", slug: "pomucky" },
    { id: "m2", slug: "opakovani" },
  ];

  it("preferuje oblíbenou metodu žáka", () => {
    expect(pickStudyMethod(methods, ["m2"])?.slug).toBe("opakovani");
  });

  it("bez oblíbené vezme první dostupnou", () => {
    expect(pickStudyMethod(methods, [])?.slug).toBe("pomucky");
  });

  it("bez metod vrátí null", () => {
    expect(pickStudyMethod([], ["m1"])).toBeNull();
  });
});

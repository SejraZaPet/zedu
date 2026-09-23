import { describe, it, expect } from "vitest";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import { normalizeBlocks, type Block } from "@/lib/textbook-config";

const paragraph = (id: string, text: string, extra: Partial<Block> = {}): Block => ({
  id,
  type: "paragraph",
  visible: true,
  props: { text },
  ...extra,
});

describe("promítací režim lekce – slideBreakBefore", () => {
  it("ruční zalomení začne nový snímek i bez nadpisu", () => {
    const slides = blocksToSlides(
      [
        paragraph("a", "Úvodní text"),
        paragraph("b", "Text na druhém snímku", { slideBreakBefore: true }),
        paragraph("c", "Pokračování druhého snímku"),
      ],
      "Lekce",
    );
    // úvodní + dva obsahové snímky
    const bodies = slides.filter((s) => s.type !== "intro" && s.type !== "summary");
    expect(bodies.length).toBe(2);
  });

  it("bez ručního zalomení se krátké odstavce nesekají", () => {
    const slides = blocksToSlides(
      [paragraph("a", "Úvodní text"), paragraph("b", "Druhý text")],
      "Lekce",
    );
    const bodies = slides.filter((s) => s.type !== "intro" && s.type !== "summary");
    expect(bodies.length).toBe(1);
  });
});

describe("promítací režim lekce – hiddenInPresentation", () => {
  it("skrytý blok se do prezentace nepřenese, v lekci zůstává", () => {
    const blocks: Block[] = [
      paragraph("a", "Viditelný text"),
      paragraph("b", "Tajná poznámka pro učitele", { hiddenInPresentation: true }),
    ];
    const slides = blocksToSlides(blocks, "Lekce");
    const allText = JSON.stringify(slides);
    expect(allText).toContain("Viditelný text");
    expect(allText).not.toContain("Tajná poznámka");
    // V lekci blok zůstává – promítání ho jen přeskočí.
    expect(blocks.length).toBe(2);
  });

  it("skryté dítě slide_group se nepřenese", () => {
    const slides = blocksToSlides(
      [
        {
          id: "g",
          type: "slide_group",
          visible: true,
          props: {
            layout: "2",
            children: [
              paragraph("c1", "Veřejná část"),
              paragraph("c2", "Skrytá část", { hiddenInPresentation: true }),
            ],
          },
        } as Block,
      ],
      "Lekce",
    );
    const allText = JSON.stringify(slides);
    expect(allText).toContain("Veřejná část");
    expect(allText).not.toContain("Skrytá část");
  });
});

describe("normalizeBlocks – prezentační příznaky", () => {
  it("zachová slideBreakBefore a hiddenInPresentation", () => {
    const normalized = normalizeBlocks([
      paragraph("a", "Text", { slideBreakBefore: true, hiddenInPresentation: true }),
    ]);
    expect(normalized[0].slideBreakBefore).toBe(true);
    expect(normalized[0].hiddenInPresentation).toBe(true);
  });

  it("nepřidává příznaky blokům bez nich", () => {
    const normalized = normalizeBlocks([paragraph("a", "Text")]);
    expect(normalized[0].slideBreakBefore).toBeUndefined();
    expect(normalized[0].hiddenInPresentation).toBeUndefined();
  });
});

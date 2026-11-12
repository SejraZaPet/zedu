import { describe, expect, it } from "vitest";
import { blocksToSlides, READABLE_SCALE_FLOOR } from "@/lib/blocks-to-slides";

const image = (id: string, caption: string) => ({
  id,
  type: "image",
  visible: true,
  props: { url: `https://example.test/${id}.jpg`, caption },
});

describe("generování snímků podle výšky", () => {
  it("ponechá čitelnou podlahu zmenšení na 85 %", () => {
    expect(READABLE_SCALE_FLOOR).toBe(0.85);
  });

  it("rozdělí tři obrázky s krátkými popisky podle jejich výšky, ne počtu znaků", () => {
    const slides = blocksToSlides([
      { id: "h", type: "heading", visible: true, props: { text: "Galerie", level: 1 } },
      image("a", "A"),
      image("b", "B"),
      image("c", "C"),
    ], "Lekce");
    const content = slides.filter((slide) => slide.type === "explain");
    expect(content).toHaveLength(2);
    expect(content.flatMap((slide) => slide.blocks).map((block) => block.id)).toEqual(["a", "b", "c"]);
  });

  it("započítá řádky tabulky a nadpis do výšky snímku", () => {
    const slides = blocksToSlides([
      { id: "h", type: "heading", visible: true, props: { text: "Přehled", level: 1 } },
      {
        id: "t",
        type: "table",
        visible: true,
        props: { headers: ["A", "B"], rows: Array.from({ length: 7 }, (_, i) => [`${i}`, "x"]) },
      },
      image("i", "Obrázek"),
    ], "Lekce");
    const content = slides.filter((slide) => slide.type === "explain");
    expect(content).toHaveLength(2);
    expect(content.flatMap((slide) => slide.blocks).map((block) => block.id)).toEqual(["t", "i"]);
  });
});

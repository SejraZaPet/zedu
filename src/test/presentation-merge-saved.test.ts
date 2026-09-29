import { describe, expect, it } from "vitest";
import { buildSlideKeys, mergePresentationSlides, mergeSlideWithSaved } from "@/lib/presentation-merge";

/** Ochrana ručních úprav prezentace při tichém přegenerování z lekce (bod A). */
describe("spojení uložené a nově vygenerované prezentace", () => {
  it("klíč snímku ignoruje přípony z dělení bloku", () => {
    const keys = buildSlideKeys([
      { slideId: "slide-1", sourceBlockId: "b1" },
      { slideId: "slide-2", sourceBlockId: "b1#2" },
    ]);
    expect(keys).toEqual(["src:b1#1", "src:b1#2"]);
  });

  it("velikost písma snímku se po přegenerování zachová", () => {
    const fresh = { slideId: "slide-1", projector: { headline: "A", body: "nový text", fontScale: 1 }, blocks: [] };
    const saved = { slideId: "slide-1", projector: { headline: "A", body: "starý", fontScale: 1.3 }, blocks: [] };
    const merged = mergeSlideWithSaved(fresh, saved) as any;
    expect(merged.projector.fontScale).toBe(1.3);
    expect(merged.projector.body).toBe("nový text");
  });

  it("ručně upravený blok se z lekce nepřepíše, ostatní se aktualizují", () => {
    const fresh = {
      projector: {},
      blocks: [
        { id: "b1", type: "paragraph", props: { text: "nový text 1" } },
        { id: "b2", type: "paragraph", props: { text: "nový text 2" } },
      ],
    };
    const saved = {
      projector: {},
      blocks: [
        { id: "b1", type: "paragraph", props: { text: "učitelův text", fontSize: 32 }, editedByTeacher: true },
        { id: "b2", type: "paragraph", props: { text: "starý text 2" } },
      ],
    };
    const merged = mergeSlideWithSaved(fresh, saved) as any;
    expect(merged.blocks[0].props.text).toBe("učitelův text");
    expect(merged.blocks[0].props.fontSize).toBe(32);
    expect(merged.blocks[1].props.text).toBe("nový text 2");
  });

  it("zamčený snímek se z lekce neaktualizuje vůbec", () => {
    const fresh = { projector: { body: "nový" }, blocks: [{ id: "b1", type: "paragraph", props: {} }] };
    const saved = { projector: { body: "učitelův" }, blocks: [], lockedFromLesson: true };
    expect((mergeSlideWithSaved(fresh, saved) as any).projector.body).toBe("učitelův");
  });

  it("ruční pořadí a smazání zůstanou, nový blok z lekce se doplní", () => {
    const fresh = {
      sourceBlockId: "group",
      projector: {},
      blocks: [
        { id: "a", type: "paragraph", props: { text: "nové A" } },
        { id: "b", type: "paragraph", props: { text: "nové B" } },
        { id: "c", type: "paragraph", props: { text: "nové C" } },
      ],
    };
    const saved = {
      sourceBlockId: "group",
      projector: {},
      structureEditedByTeacher: true,
      deletedSourceBlockIds: ["a"],
      blocks: [{ id: "b", type: "paragraph", props: { text: "staré B" } }],
    };
    const merged = mergeSlideWithSaved(fresh, saved) as any;
    expect(merged.blocks.map((b: any) => b.id)).toEqual(["b", "c"]);
    expect(merged.blocks[0].props.text).toBe("nové B");
  });

  it("přejmenování nadpisu nerozbije párování podle zdrojového bloku", () => {
    const merged = mergePresentationSlides(
      [{ sourceBlockId: "group#part1", projector: { headline: "Nový" }, blocks: [] }],
      [{ sourceBlockId: "group#2", projector: { headline: "Starý", fontScale: 1.4 }, blocks: [] }],
    ) as any[];
    expect(merged).toHaveLength(1);
    expect(merged[0].projector.headline).toBe("Nový");
    expect(merged[0].projector.fontScale).toBe(1.4);
  });
});

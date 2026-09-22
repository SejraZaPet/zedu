import { describe, it, expect } from "vitest";
import {
  extractTextFromBlocks,
  extractTablesFromBlocks,
  extractActivitiesFromBlocks,
  extractVisualBlocksFromBlocks,
  splitLessonIntoSections,
} from "@/lib/lesson-content-splitter";

const blocks = [
  { type: "heading", props: { text: "ÚVOD", level: 1 } },
  { type: "slide_group", props: { layout: "columns", children: [
    { type: "heading", props: { text: "Význam masa", level: 2 } },
    { type: "paragraph", props: { text: "Maso patří mezi důležité potraviny." } },
    { type: "image", props: { url: "maso.jpg", alt: "Druhy masa", caption: "Ukázka", width: "medium", alignment: "right" } },
    { type: "table", props: { headers: ["Druh", "Popis"], rows: [["Hovězí", "…"]] } },
    { type: "callout", props: { calloutType: "warning", text: "<p>Pozor na hygienu.</p>" } },
  ] } },
  { type: "slide_group", props: { children: [
    { type: "heading", props: { text: "Druhy masa", level: 2 } },
    { type: "bullet_list", props: { items: ["hovězí", "vepřové"] } },
    { type: "activity", props: { activityType: "sorting", title: "Třídění druhů mas" } },
  ] } },
  { type: "activity", props: { activityType: "quiz", title: "Opakování" } },
];

describe("extrakce z karet (slide_group)", () => {
  it("text obsahuje vnořené nadpisy a odstavce", () => {
    const t = extractTextFromBlocks(blocks);
    expect(t).toContain("Význam masa");
    expect(t).toContain("Druhy masa");
    expect(t).toContain("Maso patří mezi důležité potraviny.");
    expect(t).toContain("- hovězí");
  });
  it("tabulky z karet se najdou", () => {
    expect(extractTablesFromBlocks(blocks)).toHaveLength(1);
  });
  it("aktivity z karet se najdou, deep-link jen u top-level", () => {
    const a = extractActivitiesFromBlocks(blocks);
    expect(a).toHaveLength(2);
    expect(a[0].deepLinkIndex).toBeUndefined();
    expect(a[1].deepLinkIndex).toBe(3);
  });
  it("obrázky a callouty z karet se vytáhnou se vzhledem", () => {
    const visuals = extractVisualBlocksFromBlocks(blocks);
    expect(visuals).toEqual([
      expect.objectContaining({ kind: "image", url: "maso.jpg", width: "medium", alignment: "right" }),
      expect.objectContaining({ kind: "callout", variant: "warning", text: "<p>Pozor na hygienu.</p>" }),
    ]);
  });
  it("sekce drží chronologické pořadí obrázek → tabulka → callout", () => {
    const section = splitLessonIntoSections(blocks).find((s) => s.title === "Význam masa");
    expect(section?.content.map((entry) => entry.kind === "visual" ? entry.visual.kind : entry.kind)).toEqual([
      "image",
      "table",
      "callout",
    ]);
  });
});

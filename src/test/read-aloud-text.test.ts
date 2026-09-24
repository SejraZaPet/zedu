import { it, expect } from "vitest";
import { buildReadAloudText } from "@/lib/lesson-content-splitter";
import { splitIntoChunks } from "@/components/a11y/ReadAloudButton";

const blocks = [
  { type: "heading", props: { text: "<p><strong>ÚVOD</strong></p>" } },
  { type: "callout", props: { calloutType: "remember", text: "<ul><li><p>Maso je zdrojem bílkovin.</p></li></ul>" } },
  { type: "slide_group", props: { children: [
    { type: "heading", props: { text: "<p>Význam masa</p>" } },
    { type: "bullet_list", props: { html: "<ul><li><p>živočišné tuky</p></li></ul>" } },
    { type: "table", props: { headers: ["Druh"], rows: [["Hovězí"]] } },
  ] } },
  { type: "activity", props: { title: "Spoj druhy" } },
];

it("čte celý obsah včetně karet, bez aktivit a tabulek", () => {
  const t = buildReadAloudText("Úvod maso", blocks);
  expect(t).toContain("Maso je zdrojem bílkovin");
  expect(t).toContain("Význam masa");
  expect(t).toContain("živočišné tuky");
  expect(t).not.toContain("Hovězí");
  expect(t).not.toContain("Spoj druhy");
  expect(t).not.toContain("[REMEMBER]");
});

it("dělí dlouhý text na úseky se správnými offsety", () => {
  const t = "Věta jedna. ".repeat(80);
  const c = splitIntoChunks(t);
  expect(c.length).toBeGreaterThan(3);
  for (const x of c) {
    expect(x.text.length).toBeLessThanOrEqual(200);
    expect(t.slice(x.offset, x.offset + x.text.length)).toBe(x.text);
  }
});

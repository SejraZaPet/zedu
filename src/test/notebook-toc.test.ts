import { describe, it, expect } from "vitest";
import { buildToc, listSections, pageDisplayTitle } from "@/lib/notebook-toc";

const pages = [
  { id: "c", page_order: 2, title: "Vepřové", section: "Maso" },
  { id: "a", page_order: 0, title: null, section: null },
  { id: "b", page_order: 1, title: "Mytí rukou", section: "Hygiena" },
  { id: "d", page_order: 3, title: "Hovězí", section: "maso" },
  { id: "e", page_order: 4, title: "  ", section: "" },
];

describe("notebook TOC", () => {
  it("výchozí název Strana N", () => {
    expect(pageDisplayTitle({ title: null }, 0)).toBe("Strana 1");
    expect(pageDisplayTitle({ title: "  " }, 4)).toBe("Strana 5");
    expect(pageDisplayTitle({ title: "Test" }, 4)).toBe("Test");
  });

  it("seskupí podle oddílu, Bez oddílu na konci, řazení podle page_order", () => {
    const g = buildToc(pages);
    expect(g.map((x) => x.label)).toEqual(["Hygiena", "Maso", "Bez oddílu"]);
    expect(g[1].entries.map((e) => e.page.id)).toEqual(["c", "d"]);
    expect(g[2].entries.map((e) => e.displayTitle)).toEqual(["Strana 1", "Strana 5"]);
    expect(g[1].entries[0].number).toBe(3);
  });

  it("filtruje podle názvu i oddílu bez diakritiky", () => {
    expect(buildToc(pages, "vepr").flatMap((g) => g.entries.map((e) => e.page.id))).toEqual(["c"]);
    expect(buildToc(pages, "HYGIENA").flatMap((g) => g.entries.map((e) => e.page.id))).toEqual(["b"]);
    expect(buildToc(pages, "strana 5").flatMap((g) => g.entries.map((e) => e.page.id))).toEqual(["e"]);
    expect(buildToc(pages, "nic")).toEqual([]);
  });

  it("seznam oddílů je unikátní", () => {
    expect(listSections(pages)).toEqual(["Hygiena", "Maso"]);
  });
});

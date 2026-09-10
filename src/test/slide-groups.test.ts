import { describe, it, expect } from "vitest";
import {
  getGroupChildren,
  getGroupLayout,
  groupBlocksIntoSlide,
  removeChildFromGroup,
  setGroupLayout,
  ungroupSlideGroup,
  updateGroupChild,
  flattenSlideGroups,
} from "@/lib/slide-groups";
import { blocksToSlides } from "@/lib/blocks-to-slides";
import type { Block } from "@/lib/textbook-config";

const b = (id: string, type: any, props: any = {}): Block => ({ id, type, visible: true, props });

describe("spojování bloků do snímku", () => {
  const blocks = [
    b("1", "paragraph", { text: "První" }),
    b("2", "image", { url: "https://x/y.png", caption: "Foto" }),
    b("3", "table", { headers: ["A", "B"], rows: [["1", "2"]] }),
  ];

  it("spojí dva bloky do jedné skupiny na místě prvního", () => {
    const next = groupBlocksIntoSlide(blocks, ["2", "3"], 2);
    expect(next).toHaveLength(2);
    expect(next[1].type).toBe("slide_group");
    expect(getGroupChildren(next[1]).map((c) => c.id)).toEqual(["2", "3"]);
    expect(getGroupLayout(next[1])).toBe(2);
  });

  it("jeden blok skupinu nevytvoří", () => {
    expect(groupBlocksIntoSlide(blocks, ["2"])).toBe(blocks);
  });

  it("rozdělí skupinu zpět na samostatné bloky ve stejném pořadí", () => {
    const grouped = groupBlocksIntoSlide(blocks, ["1", "2"], 2);
    const restored = ungroupSlideGroup(grouped, grouped[0].id);
    expect(restored.map((x) => x.id)).toEqual(["1", "2", "3"]);
  });

  it("změní počet sloupců a upraví dítě", () => {
    const grouped = groupBlocksIntoSlide(blocks, ["1", "2"], 2);
    const gid = grouped[0].id;
    expect(getGroupLayout(setGroupLayout(grouped, gid, 3)[0])).toBe(3);
    const edited = updateGroupChild(grouped, gid, "1", { text: "Nové" });
    expect(getGroupChildren(edited[0])[0].props.text).toBe("Nové");
  });

  it("vyjmutí dítěte z dvojice skupinu rozpustí", () => {
    const grouped = groupBlocksIntoSlide(blocks, ["1", "2"], 2);
    const out = removeChildFromGroup(grouped, grouped[0].id, "1");
    expect(out.map((x) => x.id)).toEqual(["1", "2", "3"]);
  });

  it("zploští skupiny pro místa, která je neznají", () => {
    const grouped = groupBlocksIntoSlide(blocks, ["1", "2"], 2);
    expect(flattenSlideGroups(grouped).map((x) => x.id)).toEqual(["1", "2", "3"]);
  });
});

describe("generování prezentace ze spojených bloků", () => {
  it("ze skupiny vznikne JEDEN snímek se dvěma sloupci", () => {
    const grouped = groupBlocksIntoSlide(
      [
        b("h", "heading", { text: "Nadpis lekce" }),
        b("img", "image", { url: "https://x/y.png", caption: "Foto" }),
        b("tab", "table", { headers: ["A"], rows: [["1"]] }),
      ],
      ["img", "tab"],
      2,
    );

    const slides = blocksToSlides(grouped, "Lekce");
    const content = slides.filter((s) => s.type !== "intro" && s.type !== "summary");
    const groupSlide = content.find((s: any) => s.layout === "two-cols");
    expect(groupSlide).toBeTruthy();
    expect(groupSlide.blocks.map((x: any) => x.id)).toEqual(["img", "tab"]);
    // Nespojený nadpis zůstává vlastním snímkem.
    expect(content.length).toBe(2);
  });

  it("tři sloupce se přeloží na layout three-cols", () => {
    const grouped = groupBlocksIntoSlide(
      [
        b("p1", "paragraph", { text: "A" }),
        b("p2", "paragraph", { text: "B" }),
        b("p3", "paragraph", { text: "C" }),
      ],
      ["p1", "p2", "p3"],
      3,
    );
    const slides = blocksToSlides(grouped, "Lekce");
    const groupSlide = slides.find((s: any) => s.layout === "three-cols");
    expect(groupSlide.blocks).toHaveLength(3);
  });
});

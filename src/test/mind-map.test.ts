import { describe, expect, it } from "vitest";
import {
  addChild,
  countNodes,
  createDefaultMindMap,
  keyToMap,
  mapToKey,
  mindMapToOutline,
  normalizeMindMap,
  scoreMindMap,
  updateNode,
  MIND_MAP_MAX_NODES,
  type MindMapData,
} from "@/lib/mind-map";

const sample = (): MindMapData => ({
  version: 1,
  root: {
    id: "r",
    text: "Maso",
    children: [
      { id: "a", text: "", blank: true, children: [{ id: "a1", text: "Svíčková", children: [] }] },
      { id: "b", text: "Vepřové", children: [{ id: "b1", text: "", blank: true, children: [] }] },
    ],
  },
});

describe("myšlenková mapa – limity", () => {
  it("nedovolí víc než 60 pojmů", () => {
    let m = createDefaultMindMap();
    for (let i = 0; i < 100; i++) m = addChild(m, m.root.id);
    expect(countNodes(m)).toBe(MIND_MAP_MAX_NODES);
  });

  it("nedovolí hlubší větev než 4 úrovně", () => {
    let m = createDefaultMindMap();
    let parent = m.root.children[0].id;
    for (let i = 0; i < 6; i++) {
      m = addChild(m, parent);
      const flat = JSON.stringify(m);
      const next = m.root.children[0];
      let cur = next;
      while (cur.children.length) cur = cur.children[cur.children.length - 1];
      parent = cur.id;
      expect(flat.length).toBeGreaterThan(0);
    }
    let depth = 0;
    let cur = m.root;
    while (cur.children.length) { cur = cur.children[0]; depth++; }
    expect(depth).toBe(4);
  });

  it("normalizace ořízne strom hlubší než 4 úrovně", () => {
    const deep = { root: { text: "0", children: [{ text: "1", children: [{ text: "2", children: [{ text: "3", children: [{ text: "4", children: [{ text: "5", children: [] }] }] }] }] }] } };
    expect(mindMapToOutline(normalizeMindMap(deep))).not.toContain("5");
  });
});

describe("myšlenková mapa – správné odpovědi nejsou v mapě", () => {
  it("doplňovaný uzel má vždy prázdný text", () => {
    const m = normalizeMindMap({ root: { id: "r", text: "X", children: [{ id: "a", text: "tajné", blank: true, children: [] }] } });
    expect(JSON.stringify(m)).not.toContain("tajné");
    const u = updateNode(m, "a", { text: "jiné tajné" });
    expect(JSON.stringify(u)).not.toContain("tajné");
  });

  it("klíč se drží podle uzlů i po přeskupení", () => {
    const m = sample();
    const key = mapToKey(m, { a: "Hovězí", b1: "Kotleta" });
    expect(key).toEqual(["Hovězí", "Kotleta"]);
    expect(keyToMap(m, key)).toEqual({ a: "Hovězí", b1: "Kotleta" });
  });
});

describe("myšlenková mapa – vyhodnocení", () => {
  it("bez diakritiky a velikosti písmen", () => {
    expect(scoreMindMap(["hovezi", "KOTLETA"], ["Hovězí", "Kotleta"], 2).allCorrect).toBe(true);
  });

  it("přijme kteroukoli z více odpovědí oddělených středníkem", () => {
    expect(scoreMindMap(["skopové"], ["jehněčí; skopové"], 1).perBlank).toEqual([true]);
  });

  it("částečné body úměrně správným uzlům", () => {
    const r = scoreMindMap(["hovezi", "spatne"], ["Hovězí", "Kotleta"], 2);
    expect(r.correctCount).toBe(1);
    expect(r.points).toBe(1);
    expect(r.allCorrect).toBe(false);
  });

  it("prázdná odpověď není správná", () => {
    expect(scoreMindMap([], ["Hovězí"], 2).points).toBe(0);
  });
});

describe("myšlenková mapa – seznam jako textová alternativa", () => {
  it("vypíše strom jako odrážky s prázdnými místy", () => {
    expect(mindMapToOutline(sample())).toBe("Maso\n- ………\n  - Svíčková\n- Vepřové\n  - ………");
  });
});

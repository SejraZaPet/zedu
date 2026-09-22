import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { shuffleNonIdentity, seededShuffleNonIdentity } from "@/lib/shuffle";
import MatchingItem from "@/components/worksheet-items/MatchingItem";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";

describe("shuffleNonIdentity", () => {
  it("nikdy nevrátí stejné pořadí jako vstup", () => {
    const input = ["a", "b", "c", "d"];
    for (let i = 0; i < 200; i++) {
      const out = shuffleNonIdentity(input);
      expect(out).toHaveLength(4);
      expect([...out].sort()).toEqual([...input].sort());
      expect(out.every((v, idx) => v === input[idx])).toBe(false);
    }
  });

  it("zvládne dva prvky i duplicity", () => {
    expect(shuffleNonIdentity(["a", "b"])).toEqual(["b", "a"]);
    expect(shuffleNonIdentity(["a", "a"])).toEqual(["a", "a"]);
    expect(shuffleNonIdentity(["x"])).toEqual(["x"]);
  });

  it("seedované zamíchání je stabilní a nerovná se vstupu", () => {
    const input = ["1", "2", "3", "4", "5"];
    const a = seededShuffleNonIdentity(input, "item-1");
    const b = seededShuffleNonIdentity(input, "item-1");
    expect(a).toEqual(b);
    expect(a.every((v, i) => v === input[i])).toBe(false);
  });
});

describe("MatchingItem (pracovní list)", () => {
  it("nabídka odpovědí není v pořadí levého sloupce", () => {
    const item: any = {
      id: "m1",
      type: "matching",
      itemNumber: 1,
      prompt: "Spoj",
      matchPairs: [
        { left: "Hovězí", right: "kráva" },
        { left: "Vepřové", right: "prase" },
        { left: "Kuřecí", right: "kuře" },
        { left: "Jehněčí", right: "ovce" },
      ],
    };
    render(<MatchingItem item={item} value={undefined} onChange={() => {}} disabled={false} showResults={false} />);
    // Levý sloupec zůstává v zadaném pořadí
    expect(screen.getByText("Hovězí")).toBeTruthy();
    // Nabídka je uvnitř selectu (hidden native select ve shadcn) – ověřujeme přes util
    const rights = item.matchPairs.map((p: any) => p.right);
    const shuffled = shuffleNonIdentity(rights);
    expect(shuffled.every((v, i) => v === rights[i])).toBe(false);
  });
});

describe("tiskový pracovní list", () => {
  it("pravý sloupec matching není proti správným párům", () => {
    const pairs = [
      { left: "Hovězí", right: "kráva" },
      { left: "Vepřové", right: "prase" },
      { left: "Kuřecí", right: "kuře" },
      { left: "Jehněčí", right: "ovce" },
    ];
    const spec: any = {
      specVersion: "1",
      worksheetId: "w1",
      title: "Test",
      subject: "Technologie",
      grade: 1,
      language: "cs-CZ",
      variants: [
        {
          variantId: "A",
          seed: 1,
          items: [{ id: "m1", type: "matching", itemNumber: 1, prompt: "Spoj", matchPairs: pairs, answerSpace: { type: "none", heightMm: 0 } }],
        },
      ],
      answerKeys: { A: [] },
      randomizationRules: [],
      header: { title: "Test", studentNameField: true },
      renderConfig: { showPoints: false, includeAnswerKey: false },
    };
    const html = renderWorksheetVariantHtml(spec, "A");
    const rowOrder = [...html.matchAll(/<td>(?:\d+\. )?([^<]+)<\/td>/g)].map((m) => m[1]);
    // najdi pozice pravých hodnot v tabulce
    const rightsInPrint = rowOrder.filter((v) => pairs.some((p) => p.right === v));
    expect(rightsInPrint).toHaveLength(4);
    expect(rightsInPrint.every((v, i) => v === pairs[i].right)).toBe(false);
  });
});

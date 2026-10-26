import { describe, it, expect } from "vitest";
import { renderWorksheetVariantHtml, mcqKeyAnswer } from "@/lib/worksheet-print-renderer";
import { buildStudentWorksheetHtml } from "@/lib/worksheet-pdf-export";
import { WORKSHEET_SPEC_EXAMPLE } from "@/lib/worksheet-spec";

const mcqSpec = () => {
  const s = structuredClone(WORKSHEET_SPEC_EXAMPLE);
  const v = s.variants[0];
  v.items = [{ ...v.items[0], id: "m1", type: "mcq", prompt: "Kolik je 2+2?", choices: ["3", "4", "5"] } as any];
  s.answerKeys = { [v.variantId]: [{ itemId: "m1", itemNumber: 1, correctAnswer: "4" }] };
  return s;
};

describe("klíč odpovědí", () => {
  it("výběr z možností vypíše písmeno a text", () => {
    expect(mcqKeyAnswer("4", ["3", "4", "5"])).toBe("B) 4");
    expect(mcqKeyAnswer("C", ["3", "4", "5"])).toBe("C) 5");
    expect(mcqKeyAnswer("Pravda", undefined)).toBe("Pravda");
  });

  it("učitelská verze obsahuje blok učitele a klíč s písmenem", () => {
    const s = mcqSpec();
    const html = renderWorksheetVariantHtml(s, s.variants[0].variantId, { teacherVersion: true });
    expect(html).toContain("ws-teacher-block");
    expect(html).toContain("Klíč odpovědí");
    expect(html).toContain("B) 4");
  });

  it("žákovská verze klíč neobsahuje", async () => {
    const html = await buildStudentWorksheetHtml(mcqSpec(), "ws1");
    expect(html).not.toContain(`class="ws-key-item"`);
    expect(html).not.toContain("B) 4");
  });

});

describe("vzhled klíče odpovědí", () => {
  it("položka nemá úzký sloupec: zadání i odpověď jsou v jednom řádku na plnou šířku", () => {
    const s = mcqSpec();
    const html = renderWorksheetVariantHtml(s, s.variants[0].variantId, { teacherVersion: true });
    expect(html).toMatch(/<div class="ws-key-line"><span class="ws-key-num">1\.<\/span> <span class="ws-key-prompt">Kolik je 2\+2\?<\/span> <span class="ws-key-arrow">→<\/span> <span class="ws-key-answer">B\) 4<\/span><\/div>/);
    const css = (sel: string) => html.match(new RegExp(`\\${sel} \\{([^}]*)\\}`))?.[1] ?? "";
    expect(css(".ws-key-num")).not.toMatch(/width/);
    expect(css(".ws-key-line")).toMatch(/width: 100%/);
    expect(css(".ws-key-line")).toMatch(/min-width: 0/);
    expect(css(".ws-key-item")).toMatch(/break-inside: avoid/);
  });
});

describe("klíč přímo u otázek", () => {
  const MARK = "ZZTAJNAODPOVED";
  const leakSpec = () => {
    const s = structuredClone(WORKSHEET_SPEC_EXAMPLE);
    const v = s.variants[0];
    v.items = [
      { ...v.items[0], id: "m1", itemNumber: 1, type: "mcq", prompt: "Otázka?", choices: ["Jedna", MARK + "A", "Tři"] },
      { ...v.items[0], id: "t1", itemNumber: 2, type: "true_false", prompt: "Tvrzení" },
      { ...v.items[0], id: "f1", itemNumber: 3, type: "fill_blank", prompt: "", blankText: "Je to ___." },
      { ...v.items[0], id: "o1", itemNumber: 4, type: "open_answer", prompt: "Popiš", points: 2 },
    ] as any;
    s.answerKeys = { [v.variantId]: [
      { itemId: "m1", itemNumber: 1, correctAnswer: "B", explanation: MARK + "VYSV" },
      { itemId: "t1", itemNumber: 2, correctAnswer: "Nepravda" },
      { itemId: "f1", itemNumber: 3, correctAnswer: [MARK + "SLOVO"] },
      { itemId: "o1", itemNumber: 4, correctAnswer: MARK + "VZOR", rubric: "2 b za úplnost" },
    ] };
    return s;
  };

  it("u otázek vyznačí správnou možnost, slovo i vzorovou odpověď; klíč na konci chybí", () => {
    const s = leakSpec();
    const html = renderWorksheetVariantHtml(s, s.variants[0].variantId, { teacherVersion: true, answerKeyPlacement: "inline" });
    expect(html).toMatch(/<li class="ws-key-correct">[^]*?B\)<\/span> ZZTAJNAODPOVEDA/);
    expect(html).toMatch(/ws-tf-option ws-key-correct"><span[^>]*>✕<\/span> Nepravda/);
    expect(html).toContain(`ws-key-fill">${MARK}SLOVO`);
    expect(html).toContain(`Vzorová odpověď (2 body):`);
    expect(html).toContain(`${MARK}VYSV`);
    expect(html).not.toContain(`class="ws-answer-key"`);
    expect(html).toContain("ws-teacher-block");
  });

  it("„obojí“ vykreslí odpovědi u otázek i klíč na konci; bez volby zůstává jen klíč na konci", () => {
    const s = leakSpec();
    const both = renderWorksheetVariantHtml(s, s.variants[0].variantId, { teacherVersion: true, answerKeyPlacement: "both" });
    expect(both).toContain("ws-key-correct");
    expect(both).toContain(`class="ws-answer-key"`);
    const def = renderWorksheetVariantHtml(s, s.variants[0].variantId, { teacherVersion: true });
    expect(def).not.toContain("ws-key-correct");
    expect(def).toContain(`class="ws-answer-key"`);
  });

  it("žákovská verze neprozradí odpovědi ani s volbou umístění", async () => {
    const s = leakSpec();
    const r = renderWorksheetVariantHtml(s, s.variants[0].variantId, { answerKeyPlacement: "inline" });
    const st = await buildStudentWorksheetHtml(leakSpec(), "ws1");
    for (const html of [r, st]) {
      expect(html).not.toMatch(/ws-key-correct|ws-inline-key|ws-key-fill|ws-choice-box--on/);
      expect(html).not.toContain(MARK + "SLOVO");
      expect(html).not.toContain(MARK + "VZOR");
      expect(html).not.toContain(MARK + "VYSV");
    }
  });
});

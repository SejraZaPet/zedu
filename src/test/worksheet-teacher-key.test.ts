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

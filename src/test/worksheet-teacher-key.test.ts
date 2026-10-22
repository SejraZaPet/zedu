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

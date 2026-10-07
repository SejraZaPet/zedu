import { describe, it, expect } from "vitest";
import { WORKSHEET_SPEC_EXAMPLE } from "@/lib/worksheet-spec";
import { buildStudentWorksheetHtml, toStudentPrintSpec } from "@/lib/worksheet-pdf-export";
import { scoreWorksheet } from "@/components/WorksheetPlayer";

describe("žákovské PDF", () => {
  it("neobsahuje klíč odpovědí ani vysvětlení", async () => {
    const spec = { ...WORKSHEET_SPEC_EXAMPLE, renderConfig: { ...WORKSHEET_SPEC_EXAMPLE.renderConfig, includeAnswerKey: true } };
    const html = await buildStudentWorksheetHtml(spec, "ws1");
    expect(html).not.toContain("ws-key-item");
    expect(html).not.toContain("Glukóza je jednoduchý sacharid");
    expect(html).not.toContain("ws-teacher");
    expect(html).toContain("/student/pracovni-list/ws1");
    expect(toStudentPrintSpec(spec).answerKeys).toEqual({});
  });
});

describe("bodování beze změny", () => {
  it("scoreWorksheet dává stejné body jako dřív", () => {
    const v = WORKSHEET_SPEC_EXAMPLE.variants[0];
    const key = WORKSHEET_SPEC_EXAMPLE.answerKeys[v.variantId];
    const answers: Record<string, any> = {};
    key.forEach((k) => (answers[k.itemId] = k.correctAnswer));
    const res = scoreWorksheet(v.items, answers, key);
    const autoMax = v.items
      .filter((it) => key.some((k) => k.itemId === it.id) && !["open_answer", "offline_activity"].includes(it.type))
      .reduce((s, it) => s + it.points, 0);
    expect(res.score).toBe(autoMax);
    expect(res.maxScore).toBe(v.items.reduce((s, it) => s + it.points, 0));
    expect(scoreWorksheet(v.items, {}, key).score).toBe(0);
  });
});

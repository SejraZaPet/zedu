import { describe, it, expect } from "vitest";
import { buildPracticeSessionAnswersJson } from "@/lib/student-practice";

const phases = [
  {
    key: "q",
    title: "Otázky",
    content: { text: "TAJNY_ZDROJ" },
    questions: [
      { question: "TAJNA_OTAZKA?", options: ["TAJNA_MOZNOST", "B"], source_quote: "TAJNY_URYVEK", correct_index: 0 },
      { question: "Druha", options: ["A", "B"], correct_index: 1 },
    ],
  },
];
const base = { answers: { "0": 0, "1": "TAJNA_ODPOVED" }, phases, score: 1, totalScorable: 2, percent: 50 };

describe("ukládání sezení procvičování", () => {
  for (const kind of ["photo", "text", "file"]) {
    it(`zdroj ${kind} neukládá znění otázek ani úryvky`, () => {
      const out = buildPracticeSessionAnswersJson({ ...base, sourceKind: kind });
      const dump = JSON.stringify(out);
      expect(dump).not.toMatch(/TAJN/);
      expect(out).toEqual({ source: { kind }, question_count: 2, score: 1, total_scorable: 2, percent: 50 });
    });
  }
  it("lekce ukládá jako dřív (odpovědi a fáze bez obsahu)", () => {
    const out: any = buildPracticeSessionAnswersJson({ ...base, sourceKind: "lesson" });
    expect(out.answers).toEqual(base.answers);
    expect(out.phases[0].content).toBeUndefined();
    expect(out.phases[0].questions).toHaveLength(2);
    expect(out.source).toBeUndefined();
    expect(out.percent).toBe(50);
  });
  it("bez druhu zdroje se chová jako lekce", () => {
    const out: any = buildPracticeSessionAnswersJson({ ...base, sourceKind: null });
    expect(out.answers).toEqual(base.answers);
  });
});

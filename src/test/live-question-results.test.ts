import { describe, expect, it } from "vitest";
import { correctResponsePercent, formatResponsePoints } from "@/lib/live-question-results";

describe("výsledky živé otázky", () => {
  it("počítá procento správných odpovědí, nikoli průměr rychlostních bodů", () => {
    expect(correctResponsePercent([{ is_correct: true, score: 985 }, { is_correct: false, score: 0 }, { is_correct: true, score: 700 }])).toBe(67);
    expect(correctResponsePercent([])).toBe(0);
  });

  it("zobrazí skóre jako body", () => {
    expect(formatResponsePoints(985)).toBe("985 b");
    expect(formatResponsePoints(null)).toBe("0 b");
  });
});

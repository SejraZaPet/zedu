import { describe, it, expect } from "vitest";
import { scorePractice, masteryFromPercents } from "@/lib/student-practice";
import { withStops } from "@/lib/practice-method";
import { buildPhases, openExplanationSpec } from "../../supabase/functions/_shared/practice-phases";

describe("Loci – názvy zastávek", () => {
  const terms = [{ term: "A", hint: "" }, { term: "B", hint: "" }];
  const q = () => buildPhases("loci", { terms } as any, 2, "text").find((p) => p.key === "prochazeni")!.questions[0];
  it("nezdvojuje slovo Zastávka, když žák nic nevyplnil", () => {
    expect(withStops(q().text!, [])).toBe("Zastávka 1: jaký pojem tu leží?");
  });
  it("použije název žáka", () => {
    expect(withStops(q().text!, ["Dveře"])).toBe("Dveře: jaký pojem tu leží?");
  });
});

describe("Shrnutí celého zdroje", () => {
  it("recite/write žádají shrnutí celého textu, ostatní ne", () => {
    expect(openExplanationSpec(["recite", "write"])).toMatch(/CELÝ text/);
    expect(openExplanationSpec(["question"])).not.toMatch(/CELÝ text/);
  });
});

describe("Uložení skóre a mastery", () => {
  it("3/4 → percent 75 a mastery 75 % u první session", () => {
    const qs = [
      { type: "multiple_choice", correct_index: 1 }, { type: "multiple_choice", correct_index: 0 },
      { type: "true_false", correct_answer: false }, { type: "true_false", correct_answer: true },
      { type: "open", text: "x" },
    ] as any;
    const r = scorePractice(qs, { "0": 1, "1": 0, "2": false, "3": false, "4": "cokoliv" });
    expect(r).toEqual({ correct: 3, total: 4, percent: 75 });
    expect(masteryFromPercents([r.percent], r.percent)).toBe(75);
  });
  it("vážený průměr posledních tří (3,2,1)", () => {
    expect(masteryFromPercents([100, 50, 0], 0)).toBe(67);
  });
});

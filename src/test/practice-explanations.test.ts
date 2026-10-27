import { describe, it, expect } from "vitest";
import {
  verifySourceQuote, buildSourceExplanation, attachExplanations, buildPhases,
} from "../../supabase/functions/_shared/practice-phases";
import { explanationView, scorePractice, NO_EXPLANATION_MSG, sourceOriginLabel } from "@/lib/student-practice";

const SRC = "Fotosyntéza probíhá v chloroplastech.\n  Rostlina   při ní přeměňuje světelnou energii na energii chemickou.";

describe("úryvek ze zdroje", () => {
  it("najde úryvek i bez diakritiky a s jinými mezerami", () => {
    expect(verifySourceQuote("rostlina pri ni premenuje svetelnou energii", SRC)).not.toBeNull();
    expect(verifySourceQuote("Fotosyntéza   probíhá\nv chloroplastech", SRC)).not.toBeNull();
  });
  it("zahodí úryvek, který ve zdroji není", () => {
    expect(verifySourceQuote("Fotosyntéza probíhá v mitochondriích", SRC)).toBeNull();
    const e = buildSourceExplanation({ explanation: "Probíhá v chloroplastech.", source_quote: "vymyšlená věta navíc" }, SRC);
    expect(e.source_quote).toBeNull();
    expect(e.summary_only).toBe(true);
    expect(e.explanation).toBe("Probíhá v chloroplastech.");
  });
});

describe("fallbacky", () => {
  it("bez explanation použije key_points", () => {
    const e = buildSourceExplanation({ key_points: ["Bod A.", "Bod B."] }, SRC);
    expect(e.explanation).toBe("Bod A. Bod B.");
  });
  it("otevřená otázka bez vysvětlení nikdy nezmizí beze slova", () => {
    const phases = attachExplanations(buildPhases("sq4r", {}, 6, SRC), {}, SRC);
    const opens = phases.flatMap((p) => p.questions).filter((q) => q.type === "open");
    expect(opens.length).toBeGreaterThan(0);
    for (const q of opens) {
      expect(q.explain).toBeDefined();
      expect(explanationView(q)).toEqual({ kind: "missing", message: NO_EXPLANATION_MSG });
    }
    expect(explanationView({ type: "open" })).toEqual({ kind: "missing", message: NO_EXPLANATION_MSG });
  });
  it("uzavřená otázka bez vysvětlení nic neukáže", () => {
    expect(explanationView({ type: "true_false" })).toBeNull();
  });
  it("připojí vysvětlení k fázi recite", () => {
    const phases = attachExplanations(buildPhases("sq4r", {}, 6, SRC),
      { open_explanations: { recite: { explanation: "Vysvětlení.", source_quote: "probíhá v chloroplastech", key_points: ["X"] } } }, SRC);
    const q = phases.find((p) => p.key === "recite")!.questions[0];
    expect(q.explain?.source_quote).toBe("probíhá v chloroplastech");
    expect(q.explain?.summary_only).toBe(false);
  });
  it("popisek zdroje", () => {
    expect(sourceOriginLabel("Buňka")).toBe("z lekce Buňka");
    expect(sourceOriginLabel(null)).toBe("z tvého textu");
  });
});

describe("skóre", () => {
  it("otevřené odpovědi se do skóre ani mastery nepočítají", () => {
    const qs = [
      { type: "open" as const }, { type: "true_false" as const, correct_answer: true },
      { type: "open" as const },
    ];
    expect(scorePractice(qs, { "0": "cokoliv", "1": true, "2": "x" })).toEqual({ correct: 1, total: 1, percent: 100 });
  });
});

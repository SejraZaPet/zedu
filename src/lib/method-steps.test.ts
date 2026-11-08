import { describe, expect, it } from "vitest";
import {
  MAX_METHOD_PHASES,
  MAX_PRACTICE_EXAMPLES,
  createMethodPhase,
  createPracticeExample,
  methodStepsAnswerCount,
  methodStepsTotalPoints,
  normalizeMethodPhases,
  normalizePracticeExamples,
  phasesFromMethodCatalog,
  phasesFromSuggestion,
  practiceExamplesAnswerCount,
  practiceExamplesTotalPoints,
  readLastMethodSuggestion,
  SUGGEST_BY_METHOD_LAST_KEY,
} from "./method-steps";

describe("method_steps – fáze", () => {
  it("výchozí fáze je bez bodů a se řádky pro odpověď", () => {
    const p = createMethodPhase({ title: "Motivace" });
    expect(p.points).toBe(0);
    expect(p.answerMode).toBe("lines");
  });

  it("normalizace zahodí prázdné fáze a omezí počet na maximum", () => {
    const raw = [
      { title: "", task: "" },
      ...Array.from({ length: MAX_METHOD_PHASES + 3 }, (_, i) => ({ title: `F${i}`, task: "t" })),
    ];
    const out = normalizeMethodPhases(raw);
    expect(out.length).toBe(MAX_METHOD_PHASES);
    expect(out.every((p) => p.title)).toBe(true);
  });

  it("záporné body se oříznou na 0", () => {
    expect(createMethodPhase({ title: "X", points: -5 }).points).toBe(0);
  });

  it("součet bodů fází; nehodnocená část = 0 a nepočítá se", () => {
    const phases = normalizeMethodPhases([
      { title: "A", task: "t", points: 0 },
      { title: "B", task: "t", points: 3 },
    ]);
    expect(methodStepsTotalPoints(phases)).toBe(3);
  });

  it("počet odpovědí = fáze se způsobem řádky/pole", () => {
    const phases = normalizeMethodPhases([
      { title: "A", task: "t", answerMode: "none" },
      { title: "B", task: "t", answerMode: "lines" },
      { title: "C", task: "t", answerMode: "field" },
    ]);
    expect(methodStepsAnswerCount(phases)).toBe(2);
  });
});

describe("method_steps – předvyplnění z katalogu", () => {
  it("převezme kroky metody ze steps_json (řetězce)", () => {
    const phases = phasesFromMethodCatalog({
      id: "m1",
      name: "Školní pokus",
      steps_json: ["Pozorování", "Hypotéza", "Experiment", "Závěr"],
    });
    expect(phases.map((p) => p.title)).toEqual(["Pozorování", "Hypotéza", "Experiment", "Závěr"]);
    expect(phases.every((p) => p.points === 0)).toBe(true);
  });

  it("převezme kroky jako objekty s popisem", () => {
    const phases = phasesFromMethodCatalog({
      id: "m2",
      name: "Metoda",
      steps_json: [{ title: "Úvod", description: "Zapište poznatky" }],
    });
    expect(phases[0].title).toBe("Úvod");
    expect(phases[0].task).toBe("Zapište poznatky");
  });

  it("bez kroků vrátí prázdné pole (editor nabídne prázdnou fázi)", () => {
    expect(phasesFromMethodCatalog({ id: "m3", name: "Bez kroků" })).toEqual([]);
    expect(phasesFromMethodCatalog(null)).toEqual([]);
  });
});

describe("method_steps – předvyplnění z Návrhu podle metody", () => {
  const suggestion = {
    title: "Hodina o směsích",
    phases: {
      uvod: { timeMin: "5", description: "Opakování pojmů" },
      motivace: { description: "Modelová situace", activities: [{ kind: "discuss", title: "Rozebrat situaci" }] },
      hlavni: { description: "Práce ve dvojicích" },
      procviceni: { description: "Samostatná práce" },
      reflexe: { description: "Zpětná vazba" },
      zaver: { description: "Shrnutí" },
    },
  };

  it("převede 6 fází hodiny na fáze bloku, body 0", () => {
    const phases = phasesFromSuggestion(suggestion);
    expect(phases.length).toBe(6);
    expect(phases[0].title).toBe("Úvod (5 min)");
    expect(phases[1].task).toContain("Rozebrat situaci");
    expect(phases.every((p) => p.points === 0)).toBe(true);
  });

  it("bez návrhu vrátí prázdné pole", () => {
    expect(phasesFromSuggestion(null)).toEqual([]);
    expect(phasesFromSuggestion({ phases: {} })).toEqual([]);
  });

  it("přečte poslední návrh ze sessionStorage, chyba = null", () => {
    expect(readLastMethodSuggestion()).toBeNull();
    sessionStorage.setItem(SUGGEST_BY_METHOD_LAST_KEY, JSON.stringify({ suggestion }));
    expect(readLastMethodSuggestion()?.title).toBe("Hodina o směsích");
    sessionStorage.setItem(SUGGEST_BY_METHOD_LAST_KEY, "{nevalidní");
    expect(readLastMethodSuggestion()).toBeNull();
    sessionStorage.removeItem(SUGGEST_BY_METHOD_LAST_KEY);
  });
});

describe("practice_examples – příklady z praxe", () => {
  it("otázka je volitelná; prázdná se neukládá", () => {
    const e = createPracticeExample({ title: "T", situation: "S", question: "  " });
    expect(e.question).toBeUndefined();
    const e2 = createPracticeExample({ title: "T", situation: "S", question: "Co uděláte?" });
    expect(e2.question).toBe("Co uděláte?");
  });

  it("normalizace zahodí prázdné příklady a omezí počet", () => {
    const raw = [
      { title: "", situation: "" },
      ...Array.from({ length: MAX_PRACTICE_EXAMPLES + 2 }, (_, i) => ({ title: `P${i}`, situation: "s" })),
    ];
    expect(normalizePracticeExamples(raw).length).toBe(MAX_PRACTICE_EXAMPLES);
  });

  it("body a počet odpovědí", () => {
    const examples = normalizePracticeExamples([
      { title: "A", situation: "s" },
      { title: "B", situation: "s", question: "q", points: 2 },
    ]);
    expect(practiceExamplesTotalPoints(examples)).toBe(2);
    expect(practiceExamplesAnswerCount(examples)).toBe(1);
  });
});

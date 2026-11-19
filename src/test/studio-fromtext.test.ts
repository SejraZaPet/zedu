import { describe, it, expect } from "vitest";
import { draftStepsToSlides, stepProblem, stepsFromAi } from "@/lib/fromtext-slides";
import { normalizeSetSteps, parseRequest, FROM_TEXT_MAX_CHARS } from "../../supabase/functions/generate-activity-from-text/prompt";
import { slidePointsFactor, computeScore } from "../../supabase/functions/_shared/game-scoring";
import { activityToCoreQuestions } from "@/lib/live-game-core";

const ai = { steps: [
  { type: "mcq", question: "Hlavní město?", options: ["Praha", "Brno", "Ostrava"], correctIndex: 0, explanation: "Praha." },
  { type: "true_false", question: "Vltava teče Prahou.", statementTrue: true },
  { type: "open", question: "Co tě zaujalo?" },
  { type: "explain", question: "Shrnutí", body: "Krátký text." },
  { type: "mcq", question: "Bez správné", options: ["a", "b"], correctIndex: 5 },
  { type: "crossword", question: "x" },
] };

describe("generate-activity-from-text – požadavek", () => {
  it("bez types = dosavadní režim (zpětná kompatibilita)", () => {
    expect(parseRequest({ text: "Dost dlouhý text." })).toEqual({ mode: "legacy", text: "Dost dlouhý text." });
  });
  it("nad limitem 413, nic se neořízne", () => {
    const r = parseRequest({ text: "x".repeat(FROM_TEXT_MAX_CHARS + 1) });
    expect("status" in r && r.status).toBe(413);
  });
  it("sada: jen povolené typy, počet 1–12", () => {
    const r = parseRequest({ text: "Dost dlouhý text.", types: ["mcq", "hack", "open"], count: 99 });
    expect(r).toEqual({ mode: "set", text: "Dost dlouhý text.", types: ["mcq", "open"], count: 12 });
    expect("error" in parseRequest({ text: "Dost dlouhý text.", types: ["hack"] })).toBe(true);
  });
  it("server zahodí neplatné a nepovolené kroky", () => {
    const s = normalizeSetSteps(ai, ["mcq", "true_false", "open", "explain"], 10);
    expect(s.map((x) => x.type)).toEqual(["mcq", "true_false", "open", "explain"]);
    expect(normalizeSetSteps(ai, ["open"], 10).map((x) => x.type)).toEqual(["open"]);
  });
});

describe("fromtext-slides – koncept a vložení", () => {
  it("smíšené typy v pořadí, AI označení", () => {
    const steps = stepsFromAi(ai);
    expect(steps.map((s) => s.type)).toEqual(["mcq", "true_false", "open", "explain"]);
    const slides = draftStepsToSlides(steps, 1000);
    expect(slides.map((s) => s.activitySpec?.activityType ?? s.type)).toEqual(["mcq", "mcq", "wall", "explain"]);
    expect(slides.every((s) => s.ai_generated === true)).toBe(true);
    expect(slides[1].activitySpec.options.map((o: any) => o.text)).toEqual(["Pravda", "Nepravda"]);
    expect(slides[0].activitySpec.explanation).toBe("Praha.");
  });
  it("odškrtnuté a vadné kroky se nevloží; čas, body, obrázek se přenesou", () => {
    const [a, b] = stepsFromAi(ai);
    const edited = { ...a, timeLimitSec: 45, points: 2 as const, imageUrl: "https://x.cz/a.png", edited: true };
    const slides = draftStepsToSlides([edited, { ...b, include: false }], 1000);
    expect(slides).toHaveLength(1);
    expect(slides[0].activitySpec).toMatchObject({ timeLimitSec: 45, points: 2, imageUrl: "https://x.cz/a.png" });
    expect(slides[0].ai_modified_at).toBeTruthy();
    expect(stepProblem({ ...a, options: ["", "B", "C"], correctIndex: 0 })).toMatch(/prázdná/);
    expect(stepProblem({ ...a, imageUrl: "javascript:x" })).toMatch(/https/);
  });
  it("vložený kvíz převede živá hra stejně jako dřív", () => {
    const [slide] = draftStepsToSlides(stepsFromAi(ai), 1);
    expect(slide.activitySpec.correctIndex).toBe(0);
    expect(typeof activityToCoreQuestions).toBe("function");
  });
});

describe("body kroku na serveru", () => {
  it("chybějící body = beze změny, 2 = dvojnásobek, 0 = bez bodů", () => {
    expect(slidePointsFactor({ activitySpec: {} })).toBe(1);
    expect(slidePointsFactor({ activitySpec: { points: 2 } })).toBe(2);
    expect(slidePointsFactor({ activitySpec: { points: 0 } })).toBe(0);
    expect(slidePointsFactor({ activitySpec: { points: 99 } })).toBe(1);
    const base = computeScore({ mode: "standard" as any, correct: true, elapsedMs: 0, timeLimitMs: 20000, myScore: 0, streak: 1, victim: null }).score;
    expect(base).toBeGreaterThan(0);
  });
});

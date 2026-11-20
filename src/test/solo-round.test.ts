import { describe, expect, it } from "vitest";
import {
  evaluateSoloRound, isSoloRoundSlide, soloRoundItemCount, soloRoundPoints,
  soloRoundTeamScores, suggestedSoloRoundTimeSec, summarizeSoloRound,
} from "@/lib/solo-round";
import { newStep, prepareSlidesForLiveLaunch, slideToStep, stepToSlide, studioSetLiveSummary } from "@/lib/studio-step";
import { expandSlidesForLiveGame } from "@/lib/live-game-expand";

const matchingSpec = { activityType: "matching", matching: { left: ["a", "b", "c"], right: ["1", "2", "3"] } };

describe("samostatné kolo – serverové hodnocení", () => {
  it("nic neodesláno = 0, částečně = podíl, vše = všechny položky", () => {
    expect(evaluateSoloRound(matchingSpec, undefined)).toMatchObject({ correctCount: 0, totalCount: 3 });
    expect(evaluateSoloRound(matchingSpec, { selections: { 0: 0, 2: 2 } }).correctCount).toBe(2);
    expect(evaluateSoloRound(matchingSpec, { selections: { 0: 0, 1: 1, 2: 2 } })).toMatchObject({ correctCount: 3, totalCount: 3 });
  });

  it("klient nemůže změnit výsledek dodaným skóre nebo correctCount", () => {
    const result = evaluateSoloRound(matchingSpec, { selections: { 0: 1 }, score: 999999, correctCount: 3, isCorrect: true });
    expect(result.correctCount).toBe(0);
    expect(soloRoundPoints("standard", result, 2)).toBe(0);
  });

  it("řazení ověří původní indexy na pozicích", () => {
    const spec = { activityType: "ordering", ordering: { items: ["a", "b", "c"] } };
    expect(evaluateSoloRound(spec, { order: [0, 2, 1] })).toMatchObject({ correctCount: 1, totalCount: 3 });
  });

  it("doplňování respektuje velikost písmen a diakritiku podle zadání", () => {
    const spec = { activityType: "fill_blanks", fillBlanks: { text: "{{Praha/Prag}} a {{Brno}}", caseSensitive: false, diacriticSensitive: false } };
    expect(evaluateSoloRound(spec, { answers: ["prag", "brnó"] }).correctCount).toBe(2);
    expect(evaluateSoloRound(spec, { answers: ["chyba", ""] }).correctCount).toBe(0);
  });

  it("doplňování z nabídky a třídění hodnotí každou položku", () => {
    expect(evaluateSoloRound({ activityType: "fill_choice", fillChoice: { tokens: [{ type: "blank", answer: "A" }, { type: "blank", answer: "B" }] } }, { answers: ["a", "x"] }).correctCount).toBe(1);
    expect(evaluateSoloRound({ activityType: "sorting", sorting: { items: [{ text: "x", group: 1 }, { text: "y", group: 0 }] } }, { assignments: { 0: 1, 1: 1 } }).correctCount).toBe(1);
  });

  it("popis obrázku a hotspot ověří popisky, výběr i souřadnice", () => {
    expect(evaluateSoloRound({ activityType: "image_label", imageLabel: { markers: [{ label: "oko" }, { label: "ucho" }] } }, { placed: { 0: "oko", 1: "špatně" } }).correctCount).toBe(1);
    const spec = { activityType: "image_hotspot", imageHotspot: { hotspots: [{ x: 50, y: 50, radius: 8 }, { x: 10, y: 10, radius: 5 }] } };
    expect(evaluateSoloRound(spec, { positions: { 0: { x: 52, y: 49 } }, selections: { 1: 0 } }).correctCount).toBe(1);
    expect(evaluateSoloRound(spec, { selections: { 0: 0, 1: 1 } }).correctCount).toBe(2);
  });

  it("kartičky, pexeso a odkrývací karty hodnotí dokončené položky", () => {
    expect(evaluateSoloRound({ activityType: "flashcards", flashcards: [{}, {}] }, { seen: [0] }).correctCount).toBe(1);
    expect(evaluateSoloRound({ activityType: "reveal_cards", revealCards: { cards: [{}, {}] } }, { opened: [0, 1] }).correctCount).toBe(2);
    expect(evaluateSoloRound({ activityType: "memory_game", memoryGame: { pairs: [{}, {}, {}] } }, { matchedPairs: [0, 2] }).correctCount).toBe(2);
  });

  it("křížovka hodnotí celá slova bez ohledu na velikost písmen", () => {
    const spec = { activityType: "crossword", crossword: { entries: [{ answer: "PRAHA" }, { answer: "BRNO" }] } };
    expect(evaluateSoloRound(spec, { words: ["praha", "špatně"] })).toMatchObject({ correctCount: 1, totalCount: 2 });
    expect(evaluateSoloRound(spec, { words: [{ index: 1, value: "brno" }, { index: 0, value: "praha" }] }).correctCount).toBe(2);
  });
});

describe("samostatné kolo – body, režimy a týmy", () => {
  const half = { correctCount: 1, totalCount: 2 };
  it("standard a věž: 1000 × podíl × body kroku, bez rychlosti", () => {
    expect(soloRoundPoints("standard", half, 1)).toBe(500);
    expect(soloRoundPoints("tower", half, 2)).toBe(1000);
    expect(soloRoundPoints("standard", half, 0)).toBe(0);
  });
  it("Závod: podíl z 10 bodů; Krádež: podíl ze 100 bez krádeže a postihu", () => {
    expect(soloRoundPoints("race", half, 1)).toBe(5);
    expect(soloRoundPoints("steal", half, 2)).toBe(100);
    expect(soloRoundPoints("steal", { correctCount: 0, totalCount: 2 }, 1)).toBe(0);
  });
  it("průměr třídy zahrne neodeslaného jako 0 a seřadí časté chyby", () => {
    const result = summarizeSoloRound([
      { player_id: "a", answer: { correctCount: 1, totalCount: 2, itemResults: [{ index: 0, correct: true }, { index: 1, correct: false }] } },
    ], 2);
    expect(result.averageSuccessRate).toBe(25);
    expect(result.mostMissed).toEqual([{ index: 1, count: 1 }]);
  });
  it("body týmu za kolo jsou průměr na člena včetně neodeslaného", () => {
    const teams = [{ id: "t", members: ["a", "b"] }];
    const players = [{ id: "a", total_score: 1000 }, { id: "b", total_score: 500 }];
    const responses = [{ player_id: "a", score: 600 }];
    expect(soloRoundTeamScores(teams, players, responses)[0]).toMatchObject({ roundScore: 300, totalScore: 750 });
  });
});

describe("samostatné kolo – adaptér a kompatibilita", () => {
  it("nové přiřazování je jedno kolo a druhý rozpad ho už nerozloží", () => {
    const step = { ...newStep("matching"), title: "Spoj", content: matchingSpec };
    const slide = stepToSlide(step);
    expect(isSoloRoundSlide(slide)).toBe(true);
    expect(expandSlidesForLiveGame([slide])).toEqual([slide]);
    expect(prepareSlidesForLiveLaunch([slide]).slides).toHaveLength(1);
  });

  it("starý snímek Studia bez příznaku zůstane rozložený na otázky", () => {
    const legacy = { slideId: "old", type: "activity", studioStepType: "matching", activitySpec: matchingSpec };
    expect(prepareSlidesForLiveLaunch([legacy]).slides).toHaveLength(3);
    expect(slideToStep(legacy).settings.liveMode).toBe("expand");
  });

  it("starý popis obrázku se po otevření v sestavovači změní v samostatné kolo", () => {
    const old = { slideId: "image", type: "studio_step", studioStepType: "image_label", activitySpec: { activityType: "image_label", question: "Popis", imageLabel: { imageUrl: "https://x/y.png", markers: [] } } };
    const edited = stepToSlide(slideToStep(old));
    expect(edited.type).toBe("activity");
    expect(isSoloRoundSlide(edited)).toBe(true);
    expect(edited.activitySpec.timeLimitSec).toBe(45);
  });

  it("Hovězí maso: 7+5+4+4 dvojic = 4 kola, nikoli 20 otázek", () => {
    const steps = [7, 5, 4, 4].map((count) => ({
      ...newStep("matching"),
      title: `${count} dvojic`,
      content: { matching: { left: Array.from({ length: count }, (_, i) => `L${i}`), right: Array.from({ length: count }, (_, i) => `R${i}`) } },
    }));
    const slides = prepareSlidesForLiveLaunch(steps.map(stepToSlide)).slides;
    expect(slides).toHaveLength(4);
    expect(slides.every(isSoloRoundSlide)).toBe(true);
    expect(studioSetLiveSummary(steps)).toMatchObject({ regularQuestions: 0, soloRounds: 4, estimatedSeconds: 300 });
  });

  it("přednastavený čas: 15 s/položku, minimum 45, maximum 300", () => {
    expect(suggestedSoloRoundTimeSec(matchingSpec)).toBe(45);
    expect(suggestedSoloRoundTimeSec({ activityType: "matching", matching: { left: Array(7).fill("x") } })).toBe(105);
    expect(suggestedSoloRoundTimeSec({ activityType: "matching", matching: { left: Array(100).fill("x") } })).toBe(300);
    expect(soloRoundItemCount(matchingSpec)).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import { STEP_TYPES, newStep, stepToSlide, type ActivityStep, type StepTypeId } from "@/lib/studio-step";
import { activityModelFromStep, activityModelToStep } from "@/lib/activity-step-adapter";
import {
  activityModelFromBlock, activityModelFromSlide, activityModelFromSpec,
  activityModelToBlockProps, activityModelToSpec, applyActivityModelToSlide,
} from "@/lib/activity-model";

const VALID: Partial<Record<StepTypeId, Record<string, any>>> = {
  mcq: { options: ["A", "B"], correctIndex: 1 },
  true_false: { trueFalse: { statements: [{ text: "Voda je mokrá", isTrue: true }] } },
  matching: { matching: { left: ["a"], right: ["1"], pairs: [[0, 0]] } },
  ordering: { ordering: { items: ["a", "b"] } },
  fill_blanks: { fillBlanks: { text: "A {{b}}", tokens: [], caseSensitive: false } },
  fill_choice: { fillChoice: { tokens: [{ type: "blank", answer: "b" }], options: ["b", "c"] } },
  sorting: { sorting: { groups: ["A", "B"], items: [{ text: "x", group: 0 }] } },
  flashcards: { flashcards: [{ front: "a", back: "b" }] },
  memory_game: { memoryGame: { pairs: [{ left: "a", right: "b" }] } },
  crossword: { crossword: { entries: [{ answer: "A", clue: "První" }] } },
  image_label: { imageLabel: { imageUrl: "https://example.test/a.png", markers: [{ label: "a", x: 1, y: 2 }] } },
  image_hotspot: { imageHotspot: { imageUrl: "https://example.test/a.png", hotspots: [{ label: "a", x: 1, y: 2 }] } },
  reveal_cards: { revealCards: { cards: [{ title: "a", content: "b" }] } },
  explain: { body: "Výklad" },
  wall: { anonymous: true, allowMultiple: true },
  exit: { anonymous: false, allowMultiple: false },
  poll: { options: [{ id: "a", text: "Ano" }, { id: "b", text: "Ne" }] },
  wordcloud: { anonymous: true },
  teams: { teamMode: "random", teamCount: 3 },
  differentiated: { topic: "Téma", tasks: [{ title: "A", content: "Úkol" }], teamCount: 2 },
  escape: { intro: "Začni", locks: [{ clue: "Hádanka", code: "1" }], finalMessage: "Hotovo" },
  bezlistart: { prompt: "Vítej" },
  short_answer: { correctAnswer: "Odpověď" },
  word_search: { wordSearchWords: ["PRAHA", "BRNO"], wordSearchSize: 12 },
  slide: { custom: { preserved: true } },
};

function step(type: StepTypeId): ActivityStep {
  const value = newStep(type);
  return {
    ...value,
    title: "Zadání",
    content: { ...value.content, ...VALID[type], legacyContent: { keep: type } },
    explanation: "Vysvětlení",
    imageUrl: "https://example.test/q.png",
    settings: { ...value.settings, timeLimitSec: 45, points: 2, individual: true },
    _extra: { legacySlide: { keep: true } },
  };
}

describe("ActivityModel – všechny typy Studia", () => {
  it.each(STEP_TYPES.map((item) => item.id))("%s: krok → model → krok → stejný slide", (type) => {
    const original = step(type);
    const slide = stepToSlide(original);
    const model = activityModelFromStep(original);
    const restored = activityModelToStep(model, original);
    expect(stepToSlide(restored)).toEqual(slide);
    expect(restored._extra).toEqual(original._extra);
    expect(restored.ai).toEqual(original.ai);
  });

  it.each(STEP_TYPES.filter((item) => item.id !== "explain" && item.id !== "slide").map((item) => item.id))("%s: activitySpec → model → spec beze ztráty", (type) => {
    const original = stepToSlide(step(type)).activitySpec;
    original.legacyUnknown = { nested: [1, 2] };
    const restored = activityModelToSpec(activityModelFromSpec(original), original);
    expect(restored).toEqual(original);
  });
});

describe("ActivityModel – blok a slide", () => {
  it("převod prázdného Studia na slide uchová čtyři editační pole", () => {
    const empty = newStep("mcq");
    const spec = stepToSlide(empty).activitySpec;
    expect(spec.options).toHaveLength(4);
    expect(spec.options.every((option: any) => option.text === "")).toBe(true);
    expect(activityModelFromSpec(spec).options).toHaveLength(4);
  });

  it("víceotázkový kvíz zachová otázky, prázdné odpovědi i stará pole", () => {
    const props = {
      activityType: "quiz", title: "Kvíz", required: true,
      quiz: { questions: [{ question: "Q", answers: [{ text: "", correct: true }, { text: "B", correct: false }], explanation: "Proč" }] },
      colors: { card: "#F3F1E6" }, legacy: 7,
    };
    expect(activityModelToBlockProps(activityModelFromBlock({ props }), props)).toEqual(props);
  });

  it("prázdná Studio odpověď se v modelu nezahodí", () => {
    const original = newStep("mcq");
    original.content.options = ["", "Odpověď", ""];
    original.content.correctIndex = 2;
    const restored = activityModelToStep(activityModelFromStep(original), original);
    expect(restored.content.options).toEqual(["", "Odpověď", ""]);
    expect(restored.content.correctIndex).toBe(2);
  });

  it("slide zachová herní režim a změní jen účast tohoto slidu", () => {
    const slide = {
      slideId: "s", type: "activity", teacherNotes: "Poznámka",
      gameSettings: { mode: "classic", speedBonus: true, teamMode: "random" },
      activitySpec: { activityType: "wordcloud", question: "Slovo?", anonymous: true },
    };
    const model = activityModelFromSlide(slide);
    model.settings.participation = "manual";
    const changed = applyActivityModelToSlide(slide, model);
    expect(changed.gameSettings).toEqual({ mode: "classic", speedBonus: true, teamMode: "manual" });
    expect(changed.teacherNotes).toBe("Poznámka");
    model.settings.participation = "inherit";
    expect(applyActivityModelToSlide(changed, model).gameSettings).toEqual({ mode: "classic", speedBonus: true });
  });
});

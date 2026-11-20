import { describe, it, expect } from "vitest";
import {
  STEP_TYPES, newStep, stepToSlide, slideToStep, stepToBlock, blockToSteps, clampStepTime, normalizePoints,
  prepareSlidesForLiveLaunch, gameTemplateToSet, activityTemplateToSteps, aiStepToStep, aiStepsToSteps,
  stepProblem, stepBadges, isStudioSet, type ActivityStep, type StepTypeId,
} from "@/lib/studio-step";
import { GAME_MODES } from "@/lib/game-modes";
import { normalizeSetSteps, parseRequest, SET_STEP_TYPES } from "../../supabase/functions/generate-activity-from-text/prompt";

const VALID: Partial<Record<StepTypeId, Record<string, any>>> = {
  mcq: { options: ["A", "B", "C"], correctIndex: 1 },
  true_false: { trueFalse: { statements: [{ text: "Voda je mokrá", isTrue: true }] } },
  matching: { matching: { left: ["a", "b"], right: ["1", "2"] } },
  ordering: { ordering: { items: ["x", "y", "z"] } },
  fill_blanks: { fillBlanks: { text: "Praha je {{město}}.", tokens: [], caseSensitive: false, diacriticSensitive: true } },
  fill_choice: { fillChoice: { tokens: [{ type: "text", value: "Voda vře při " }, { type: "blank", answer: "100" }], options: ["100", "90"] } },
  sorting: { sorting: { groups: ["A", "B"], items: [{ text: "x", group: 0 }] } },
  flashcards: { flashcards: [{ front: "f", back: "b" }] },
  memory_game: { memoryGame: { pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] } },
  crossword: { crossword: { entries: [{ answer: "PRAHA", clue: "město" }, { answer: "BRNO", clue: "město 2" }] } },
  image_label: { imageLabel: { imageUrl: "https://x/y.png", markers: [{ label: "a", x: 1, y: 2 }], tolerance: 5, shuffleWords: true } },
  image_hotspot: { imageHotspot: { imageUrl: "https://x/y.png", hotspots: [{ label: "a", x: 1, y: 2, radius: 8 }] } },
  reveal_cards: { revealCards: { cards: [{ title: "t", content: "c" }] } },
  explain: { body: "Text výkladu" },
  wall: { anonymous: true, allowMultiple: false },
  exit: { anonymous: true, allowMultiple: false },
  poll: { options: [{ id: "a", text: "Ano" }, { id: "b", text: "Ne" }] },
  wordcloud: { anonymous: true },
  teams: { teamMode: "random", teamCount: 3 },
  differentiated: { topic: "t", tasks: [{ title: "a", content: "b" }], teamCount: 2 },
  escape: { intro: "", locks: [{ clue: "c", code: "1" }], finalMessage: "" },
};

function filled(type: StepTypeId, patch: Partial<ActivityStep> = {}): ActivityStep {
  const s = newStep(type);
  return { ...s, title: "Zadání kroku", content: { ...(type === "teams" || type === "differentiated" || type === "escape" ? { activityType: type } : {}), ...VALID[type] }, ...patch };
}
const buildable = STEP_TYPES.filter((t) => !t.worksheetOnly && t.editor !== "slide");

describe("Studio – adaptér krok ↔ snímek (všechny typy)", () => {
  it.each(buildable.map((t) => t.id))("%s: platný krok projde tam a zpět beze ztráty", (type) => {
    const step = filled(type, { explanation: "Proč", settings: { timeLimitSec: 45, points: 2, individual: true } });
    expect(stepProblem(step)).toBeNull();
    const slide = stepToSlide(step);
    const back = slideToStep(slide);
    expect(back.type).toBe(type);
    expect(back.title).toBe("Zadání kroku");
    // Výklad nemá odpověď: čas ani body se k němu neukládají (UI je nenabízí).
    if (type !== "explain") expect(back.settings).toMatchObject({ timeLimitSec: 45, points: 2, individual: true });
    expect(stepToSlide(back)).toEqual(slide);
  });

  it("samostatné kolo i ostatní živé typy se ukládají jako běžné snímky", () => {
    expect(stepToSlide(filled("sorting")).type).toBe("activity");
    expect(stepToSlide(filled("sorting")).activitySpec.soloRound).toBe(true);
    expect(stepToSlide(filled("crossword")).type).toBe("activity");
    expect(stepToSlide(filled("mcq")).type).toBe("activity");
    expect(stepToSlide(filled("explain")).type).toBe("explain");
    expect(stepToSlide(filled("exit")).activitySpec.activityType).toBe("wall");
  });

  it("neznámé vlastnosti starých snímků zůstanou (_extra)", () => {
    const legacy = {
      slideId: "s1", type: "activity", foo: { bar: 1 }, teacherNotes: "pozn", backgroundOverride: "x",
      projector: { headline: "Otázka?", body: "", assetRefs: [] }, device: { instructions: "Vyberte." },
      activitySpec: { activityType: "mcq", question: "Otázka?", options: [{ text: "A", correct: true, isCorrect: true }, { text: "B", correct: false, isCorrect: false }], correctIndex: 0, timeLimitSec: 20, custom: 7 },
    };
    const back = stepToSlide(slideToStep(legacy));
    expect(back.foo).toEqual({ bar: 1 });
    expect(back.teacherNotes).toBe("pozn");
    expect(back.activitySpec.custom).toBe(7);
    expect(back.activitySpec.timeLimitSec).toBe(20);
    expect(back.activitySpec.options).toEqual(legacy.activitySpec.options);
  });

  it("snímek bez aktivity (prezentace) projde jako „Jiný snímek“ beze změny", () => {
    const content = { slideId: "c1", type: "content", projector: { headline: "Nadpis", body: "Text" }, device: { instructions: "" } };
    const step = slideToStep(content);
    expect(step.type).toBe("slide");
    const out = stepToSlide(step);
    expect(out.type).toBe("content");
    expect(out.activitySpec).toBeUndefined();
    expect(out.projector).toEqual(content.projector);
  });
});

describe("Studio – adaptér krok ↔ blok lekce", () => {
  const solo = STEP_TYPES.filter((t) => t.solo && t.editor !== "slide" && t.id !== "exit").map((t) => t.id);
  it.each(solo)("%s: krok → blok → krok → stejný blok", (type) => {
    const block = stepToBlock(filled(type, { explanation: "Vysv" }))!;
    expect(block.type).toBe("activity");
    const steps = blockToSteps(block);
    expect(steps).toHaveLength(1);
    expect(steps[0].type).toBe(type);
    expect(stepToBlock(steps[0])).toEqual(block);
  });

  it("kvíz v lekci se dvěma otázkami = dva kroky Kvíz", () => {
    const block = { id: "b1", type: "activity", props: { activityType: "quiz", title: "Q", quiz: { questions: [
      { question: "1?", answers: [{ text: "a", correct: true }, { text: "b", correct: false }] },
      { question: "2?", answers: [{ text: "c", correct: false }, { text: "d", correct: true }] },
    ] } } };
    const steps = blockToSteps(block);
    expect(steps.map((s) => [s.type, s.title, s.content.correctIndex])).toEqual([["mcq", "1?", 0], ["mcq", "2?", 1]]);
  });

  it("neznámé vlastnosti bloku se zachovají", () => {
    const block = { id: "b2", type: "activity", props: { activityType: "ordering", title: "T", required: true, instructions: "i", ordering: { items: ["a", "b"] } } };
    expect(stepToBlock(blockToSteps(block)[0])).toEqual(block);
  });

  it("výklad, typy jen živě a pracovní list do lekce nejdou (null / [])", () => {
    for (const t of ["explain", "poll", "wordcloud", "teams", "escape"] as StepTypeId[]) expect(stepToBlock(filled(t))).toBeNull();
    expect(blockToSteps({ type: "heading", props: {} })).toEqual([]);
    expect(blockToSteps({ type: "activity", props: { activityType: "neznamy" } })).toEqual([]);
  });
});

describe("Studio – čas a body", () => {
  it("čas: null = výchozí, 0 a méně = bez limitu, jinak 5–600 s", () => {
    expect(clampStepTime(null)).toBeNull();
    expect(clampStepTime(undefined)).toBeNull();
    expect(clampStepTime(0)).toBe(0);
    expect(clampStepTime(-3)).toBe(0);
    expect(clampStepTime(3)).toBe(5);
    expect(clampStepTime(900)).toBe(600);
    expect(clampStepTime(45)).toBe(45);
  });
  it("čas 0 se zapíše jako bez limitu, výchozí se nezapíše", () => {
    expect(stepToSlide(filled("mcq", { settings: { timeLimitSec: 0, points: 1, individual: false } })).activitySpec.timeLimitSec).toBe(0);
    expect("timeLimitSec" in stepToSlide(filled("mcq", { settings: { timeLimitSec: null, points: 1, individual: false } })).activitySpec).toBe(false);
    expect(stepProblem(filled("mcq", { settings: { timeLimitSec: 700, points: 1, individual: false } }))).toMatch(/5–600/);
  });
  it("body 0/1/2: 1 se nezapisuje (zachová staré bodování), 0 a 2 ano", () => {
    expect(stepToSlide(filled("mcq", { settings: { timeLimitSec: 30, points: 0, individual: false } })).activitySpec.points).toBe(0);
    expect(stepToSlide(filled("mcq", { settings: { timeLimitSec: 30, points: 2, individual: false } })).activitySpec.points).toBe(2);
    expect("points" in stepToSlide(filled("mcq")).activitySpec).toBe(false);
    expect(normalizePoints(3)).toBe(1);
    expect(normalizePoints(undefined)).toBe(1);
  });
  it("„jednotlivě“ = gameSettings.teamMode none, jinak bez přepisu týmů", () => {
    expect(stepToSlide(filled("mcq", { settings: { timeLimitSec: 30, points: 1, individual: true } })).gameSettings).toEqual({ teamMode: "none" });
    expect(stepToSlide(filled("mcq")).gameSettings).toBeUndefined();
  });
});

describe("Studio – živé spuštění a starý rozpad", () => {
  it("starý studio_step se vynechá a starý rozpad zdědí body a jednotlivě", () => {
    const legacy = { slideId: "old", type: "activity", activitySpec: { activityType: "mcq", question: "?", options: [{ text: "a", correct: true }, { text: "b", correct: false }], correctIndex: 0 } };
    const skippedStep = { slideId: "skipped", type: "studio_step", studioStepType: "sorting", activitySpec: { activityType: "sorting", question: "Roztřiď" } };
    const legacyMatching = stepToSlide(filled("matching", { settings: { timeLimitSec: 20, points: 2, individual: true, liveMode: "expand" } }));
    const { slides: out, skipped } = prepareSlidesForLiveLaunch([legacy, skippedStep, legacyMatching, stepToSlide(filled("wordcloud"))]);
    expect(skipped).toEqual([{ title: "Roztřiď", label: "Třídění" }]);
    expect(out[0]).toBe(legacy);
    const mcqs = out.filter((s) => s.expandedFrom === "matching");
    expect(mcqs).toHaveLength(2);
    for (const m of mcqs) {
      expect(m.activitySpec.points).toBe(2);
      expect(m.activitySpec.timeLimitSec).toBe(20);
      expect(m.gameSettings).toEqual({ teamMode: "none" });
    }
    expect(out.some((s) => s.activitySpec?.activityType === "wordcloud")).toBe(true);
  });
  it("všechny typy se samostatným hráčem už jdou živě; osmisměrka zůstává v listu", () => {
    expect(STEP_TYPES.filter((t) => t.live === "no" && !t.worksheetOnly && !t.solo).map((t) => t.id)).toEqual([]);
  });
  it("štítky: třídění je Samostatné kolo, mrak Jen živě, osmisměrka Jen pracovní list", () => {
    expect(stepBadges("sorting")).toEqual(["Samostatné kolo", "Samostatně", "Tisk"]);
    expect(stepBadges("wordcloud")).toEqual(["Jen živě"]);
    expect(stepBadges("word_search")).toEqual(["Jen pracovní list"]);
    expect(stepBadges("mcq")).toEqual(["Živě", "Samostatně", "Tisk"]);
  });
});

describe("Studio – Ze šablony", () => {
  it("hra z knihovny (i demo) vytvoří novou sadu s novými ID", () => {
    const tpl = { title: "Demo hra", subject: "Fyzika", default_game_mode: "race", default_team_mode: "random", default_team_count: 9, demo_seed_key: "seed",
      activity_data: [stepToSlide(filled("mcq")), stepToSlide(filled("sorting"))] };
    const set = gameTemplateToSet(tpl);
    expect(set.title).toBe("Demo hra");
    expect(set.gameMode).toBe("race");
    expect(set.teamCount).toBe(6);
    expect(set.steps.map((s) => s.type)).toEqual(["mcq", "sorting"]);
    expect(set.steps[0].id).not.toBe(tpl.activity_data[0].slideId);
    expect((set as any).demo_seed_key).toBeUndefined();
    expect(isStudioSet(set.steps.map(stepToSlide))).toBe(true);
  });
  it("šablona aktivity vytvoří krok daného typu; neznámý typ nic", () => {
    expect(activityTemplateToSteps({ name: "Spoj", activity_type: "matching", template_props: { required: true } })[0].type).toBe("matching");
    expect(activityTemplateToSteps({ name: "Q", activity_type: "quiz" })[0].type).toBe("mcq");
    expect(activityTemplateToSteps({ name: "P", activity_type: "poll" })[0].type).toBe("poll");
    expect(activityTemplateToSteps({ name: "X", activity_type: "table" })).toEqual([]);
  });
});

describe("Studio – herní režimy mají popis jednou větou", () => {
  it("texty z plánu (sekce 3)", () => {
    expect(Object.fromEntries(GAME_MODES.map((m) => [m.id, m.summary]))).toEqual({
      standard: "Všichni odpovídají naráz a za správnou a rychlou odpověď získají víc bodů.",
      race: "Každý postupuje svým tempem a za správnou odpověď posune svou postavu na dráze.",
      tower: "Za každou správnou odpověď přibude patro věže.",
      steal: "Správná odpověď ukradne body vedoucímu hráči, špatná body ubere.",
    });
  });
});

const AI_OK: Record<string, any> = {
  mcq: { type: "mcq", question: "Q?", options: ["a", "b", "c"], correctIndex: 2 },
  true_false: { type: "true_false", question: "Tvrzení", statementTrue: false },
  open: { type: "open", question: "Co myslíš?" },
  explain: { type: "explain", question: "Nadpis", body: "Text" },
  matching: { type: "matching", question: "Spoj", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] },
  ordering: { type: "ordering", question: "Seřaď", items: ["1", "2", "3"] },
  fill_blanks: { type: "fill_blanks", question: "Doplň", text: "Praha je {{město}} a {{hlavní}}." },
  sorting: { type: "sorting", question: "Roztřiď", groups: [{ name: "A", items: ["x"] }, { name: "B", items: ["y"] }] },
  flashcards: { type: "flashcards", question: "Pojmy", cards: [{ front: "f", back: "b" }] },
  memory_game: { type: "memory_game", question: "Pexeso", pairs: [{ left: "a", right: "1" }, { left: "b", right: "2" }] },
  reveal_cards: { type: "reveal_cards", question: "Karty", cards: [{ front: "t", back: "c" }] },
  crossword: { type: "crossword", question: "Křížovka", entries: [{ answer: "praha", clue: "m" }, { answer: "brno", clue: "m2" }] },
  poll: { type: "poll", question: "Anketa", options: ["ano", "ne"] },
  wordcloud: { type: "wordcloud", question: "Jedním slovem?" },
};
const AI_BAD: Record<string, any> = {
  mcq: { type: "mcq", question: "Q?", options: ["a"], correctIndex: 0 },
  true_false: { type: "true_false", question: "T" },
  open: { type: "open", question: "" },
  explain: { type: "explain", question: "" },
  matching: { type: "matching", question: "S", pairs: [{ left: "a", right: "1" }] },
  ordering: { type: "ordering", question: "S", items: ["1"] },
  fill_blanks: { type: "fill_blanks", question: "D", text: "bez mezer" },
  sorting: { type: "sorting", question: "R", groups: [{ name: "A", items: ["x"] }] },
  flashcards: { type: "flashcards", question: "P", cards: [] },
  memory_game: { type: "memory_game", question: "P", pairs: [{ left: "a", right: "1" }] },
  reveal_cards: { type: "reveal_cards", question: "K", cards: [{ front: "", back: "" }] },
  crossword: { type: "crossword", question: "K", entries: [{ answer: "dvě slova", clue: "x" }, { answer: "ok", clue: "" }] },
  poll: { type: "poll", question: "A", options: ["jen jedna"] },
  wordcloud: { type: "wordcloud", question: "" },
};

describe("Studio – AI návrh z celého rozsahu typů", () => {
  it("server přijme rozšířené typy a staré 4 typy fungují dál", () => {
    const r = parseRequest({ text: "dost dlouhý text", types: ["sorting", "crossword", "nesmysl"], count: 3 });
    expect("mode" in r && r.mode === "set" && r.types).toEqual(["sorting", "crossword"]);
    expect(SET_STEP_TYPES.slice(0, 4)).toEqual(["mcq", "true_false", "open", "explain"]);
    expect("mode" in parseRequest({ text: "dost dlouhý text" }) && (parseRequest({ text: "dost dlouhý text" }) as any).mode).toBe("legacy");
  });
  it.each(Object.keys(AI_OK))("%s: server i klient přijmou platný a zahodí neplatný krok", (type) => {
    const all = [...SET_STEP_TYPES];
    expect(normalizeSetSteps({ steps: [AI_OK[type]] }, all, 5)).toHaveLength(1);
    expect(normalizeSetSteps({ steps: [AI_BAD[type]] }, all, 5)).toHaveLength(0);
    const ok = aiStepToStep(normalizeSetSteps({ steps: [AI_OK[type]] }, all, 5)[0]);
    expect(ok).not.toBeNull();
    expect(stepProblem(ok!)).toBeNull();
    expect(ok!.ai.generated).toBe(true);
    expect(aiStepToStep(AI_BAD[type])).toBeNull();
  });
  it("doplňování z AI dostane tokeny (normalizace activity-ai-normalize)", () => {
    const s = aiStepToStep(AI_OK.fill_blanks)!;
    expect(s.content.fillBlanks.tokens.filter((t: any) => t.type === "blank").map((t: any) => t.answer)).toEqual(["město", "hlavní"]);
  });
  it("zahozené kroky se spočítají (klient + server)", () => {
    const r = aiStepsToSteps({ steps: [AI_OK.mcq, AI_BAD.poll, { type: "neznámý", question: "x" }], dropped: 1 });
    expect(r.steps).toHaveLength(1);
    expect(r.dropped).toBe(3);
  });
});

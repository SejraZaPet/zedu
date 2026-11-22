import { describe, it, expect } from "vitest";
import { ACTIVITY_PRESETS } from "@/lib/activity-slide-presets";
import { activityBlockToSlide } from "@/lib/plan-to-slides";
import {
  applySlidePatch, buildAiActivitySpec, fixMistypedActivitySpec, normalizePresentationSlide, normalizePresentationSlides,
} from "@/lib/presentation-activity";
import { preparePresentationForLive, launchReportMessage } from "@/lib/presentation-live-launch";
import { buildPresetIntoSlide, canHostActivity } from "@/lib/presentation-activity-insert";
import { collectActivityBlocks, collectStudioActivities, cloneStudioSlide } from "@/lib/presentation-activity-sources";
import { attachLessonRef, readLessonRef } from "@/lib/presentation-lesson-ref";
import { activityToCoreQuestions } from "@/lib/live-game-core";
import { slideKeyDirection, isTypingTarget } from "@/components/live/LiveSlideTopNav";

const preset = (id: string) => ACTIVITY_PRESETS.find((p) => p.id === id)!.build();
/** Uložení do DB a znovuotevření = JSON + líná normalizace. */
const saveAndReopen = (slides: any[]) => normalizePresentationSlides(JSON.parse(JSON.stringify(slides)));
const mcqs = (slides: any[]) => slides.filter((s) => s.activitySpec?.activityType === "mcq");

describe("vložit → upravit → uložit → znovu otevřít → spustit", () => {
  it("kvíz z lekce: úprava formuláře se projeví na plátně i ve hře, 3 otázky se rozloží", () => {
    const block = { id: "b1", type: "activity", props: { activityType: "quiz", title: "Kvíz", quiz: { questions: [
      { question: "Q1", answers: [{ text: "a", correct: true }, { text: "b" }] },
      { question: "Q2", answers: [{ text: "c" }, { text: "d", correct: true }] },
    ] } } };
    let slide = activityBlockToSlide(block);
    const q = slide.activitySpec.quiz.questions;
    slide = applySlidePatch(slide, { activitySpec: { ...slide.activitySpec, quiz: { questions: [...q, { question: "Q3 upravená", answers: [{ text: "e", correct: true }, { text: "f" }] }] } } });
    expect(slide.blocks[0].props.quiz.questions).toHaveLength(3); // plátno = hra
    const reopened = saveAndReopen([slide]);
    const live = preparePresentationForLive(reopened);
    expect(mcqs(live.slides).map((s) => s.activitySpec.question)).toEqual(["Q1", "Q2", "Q3 upravená"]);
    expect(mcqs(live.slides)[1].activitySpec.correctIndex).toBe(1);
  });

  it("pravda/nepravda: úprava tvrzení na plátně (blok) se dostane do hry", () => {
    let slide = activityBlockToSlide({ id: "b", type: "activity", props: { activityType: "true_false", trueFalse: { statements: [{ text: "Staré", isTrue: true }] } } });
    const blocks = [{ ...slide.blocks[0], props: { ...slide.blocks[0].props, trueFalse: { statements: [{ text: "Voda vře při 100 °C", isTrue: true }, { text: "Led je teplý", isTrue: false }] } } }];
    slide = applySlidePatch(slide, { blocks });
    const live = preparePresentationForLive(saveAndReopen([slide]));
    expect(mcqs(live.slides).map((s) => [s.activitySpec.question, s.activitySpec.correctIndex])).toEqual([["Voda vře při 100 °C", 0], ["Led je teplý", 1]]);
  });

  it("dvojice ze šablony: upravené dvojice → otázka na každý pojem", () => {
    let slide = preset("matching");
    slide = applySlidePatch(slide, { activitySpec: { ...slide.activitySpec, matching: { left: ["Praha", "Brno", "Ostrava"], right: ["Vltava", "Svratka", "Odra"] } } });
    const live = preparePresentationForLive(saveAndReopen([slide]));
    expect(mcqs(live.slides)).toHaveLength(3);
    expect(mcqs(live.slides)[0].activitySpec.question).toContain("Praha");
  });

  it("seřazení: body a týmové nastavení se přenesou na každou otázku", () => {
    let slide = preset("ordering");
    slide = applySlidePatch(slide, { activitySpec: { ...slide.activitySpec, points: 2, ordering: { items: ["Jaro", "Léto", "Podzim"] } }, gameSettings: { teamMode: "random" } });
    const live = preparePresentationForLive(saveAndReopen([slide]));
    expect(mcqs(live.slides)).toHaveLength(3);
    expect(mcqs(live.slides).every((s) => s.activitySpec.points === 2 && s.gameSettings?.teamMode === "random")).toBe(true);
  });

  it("víceotázkový kvíz přenese do živé hry barvy, obrázek i AI označení", () => {
    const slide = { slideId: "q", type: "activity", ai_generated: true, ai_modified_at: "2026-11-22T01:00:00Z", activitySpec: { activityType: "quiz", colors: { card: "#F3F1E6" }, imageUrl: "https://img.test/q.png", quiz: { questions: [{ question: "Q", answers: [{ text: "A", correct: true }] }] } } };
    const [liveSlide] = preparePresentationForLive([slide]).slides;
    expect(liveSlide.activitySpec.colors).toEqual({ card: "#F3F1E6" });
    expect(liveSlide.activitySpec.imageUrl).toBe("https://img.test/q.png");
    expect(liveSlide).toMatchObject({ ai_generated: true, ai_modified_at: "2026-11-22T01:00:00Z" });
  });

  it("slovní mrak: zůstane jedním slidem a hlášení řekne, že je bez bodování", () => {
    let slide = preset("wordcloud");
    slide = applySlidePatch(slide, { activitySpec: { ...slide.activitySpec, question: "Co vás napadne u slova voda?" } });
    const live = preparePresentationForLive(saveAndReopen([slide]));
    expect(live.slides).toHaveLength(1);
    expect(live.slides[0].activitySpec.question).toBe("Co vás napadne u slova voda?");
    expect(launchReportMessage(live)).toMatch(/Bez bodování.*Slovní mrak/);
  });

  it("kroky Studia, které živě nejdou, se nahlásí jako přeskočené; prázdný kvíz jako neúplný", () => {
    const live = preparePresentationForLive([
      { slideId: "x", type: "studio_step", studioStepType: "crossword", activitySpec: { activityType: "crossword", question: "Křížovka" } },
      { slideId: "y", type: "activity", activitySpec: { activityType: "quiz", quiz: { questions: [] } }, projector: { headline: "Prázdný" } },
    ]);
    expect(live.skipped).toHaveLength(1);
    expect(live.incomplete).toEqual(["Prázdný"]);
    expect(launchReportMessage(live)).toMatch(/Přeskočeno.*Křížovka/);
  });
});

describe("jeden zdroj pravdy a oprava starých dat", () => {
  it("líná normalizace sloučí blok a spec bez ztráty (spec má přednost)", () => {
    const s = { type: "activity", activitySpec: { activityType: "quiz", title: "Nový" }, blocks: [{ id: "a", type: "activity", props: { activityType: "quiz", title: "Starý", workMode: "pairs" } }] };
    const n = normalizePresentationSlide(s);
    expect(n.activitySpec).toEqual({ activityType: "quiz", title: "Nový", workMode: "pairs" });
    expect(n.blocks[0].props).toEqual(n.activitySpec);
    expect(normalizePresentationSlide(n)).toBe(n); // idempotentní
  });
  it("chybně uložená AI aktivita (kvízová data pod typem pravda/nepravda) se opraví na kvíz", () => {
    const bad = { activityType: "true_false", question: "Q", options: [{ text: "a" }, { text: "b" }], correctIndex: 1 };
    expect(fixMistypedActivitySpec(bad).activityType).toBe("mcq");
    const ok = { activityType: "true_false", trueFalse: { statements: [] }, options: [{}, {}], correctIndex: 0 };
    expect(fixMistypedActivitySpec(ok)).toBe(ok);
    const poll = { activityType: "poll", options: [{ text: "x" }, { text: "y" }], correctIndex: 0 };
    expect(fixMistypedActivitySpec(poll)).toBe(poll);
  });
  it("AI aktivita vytvoří data podle skutečného typu", () => {
    const ai = { question: "Hlavní město ČR", options: ["Praha", "Brno", "Plzeň"], correctIndex: 0 };
    const tf = buildAiActivitySpec("true_false", ai).spec;
    expect(tf.activityType).toBe("true_false");
    expect(tf.trueFalse.statements).toEqual([
      { text: "Hlavní město ČR – Praha", isTrue: true }, { text: "Hlavní město ČR – Brno", isTrue: false }, { text: "Hlavní město ČR – Plzeň", isTrue: false },
    ]);
    expect(buildAiActivitySpec("wall", ai).spec).toMatchObject({ activityType: "wall", question: "Hlavní město ČR" });
    expect(buildAiActivitySpec("open", ai).spec.activityType).toBe("wall");
    expect(buildAiActivitySpec("poll", ai).spec.options).toEqual([{ text: "Praha" }, { text: "Brno" }, { text: "Plzeň" }]);
    const m = buildAiActivitySpec("matching", ai);
    expect(m.spec.activityType).toBe("mcq");
    expect(m.note).toMatch(/Dvojice/);
    expect(buildAiActivitySpec("quiz", ai).spec).toMatchObject({ activityType: "mcq", correctIndex: 0 });
  });
  it("převodník zná typ mcq", () => {
    expect(activityToCoreQuestions({ activityType: "mcq", question: "Q", options: [{ text: "a" }, { text: "b", correct: true }], correctIndex: 1 }))
      .toEqual([{ question: "Q", answers: ["a", "b"], correctIndex: 1 }]);
  });
});

describe("vložení do slidu a zdroje aktivit", () => {
  it("aktivita jde do prázdného slidu (zůstane nadpis a pozadí), do slidu s textem ne", () => {
    const empty = { slideId: "s", type: "content", projector: { headline: "Úvod", body: "" }, blocks: [], backgroundOverride: { color: "#000" } };
    expect(canHostActivity(empty)).toBe(true);
    const host = buildPresetIntoSlide(empty, preset("poll"));
    expect(host).toMatchObject({ slideId: "s", type: "activity", backgroundOverride: { color: "#000" } });
    expect(host.projector.headline).toBe("Úvod");
    expect(canHostActivity({ type: "content", blocks: [{ type: "paragraph", props: { text: "Výklad" } }] })).toBe(false);
    expect(canHostActivity(host)).toBe(false);
  });
  it("vložení AI aktivity na aktuální slide zachová označení AI i lidské úpravy", () => {
    const current = { slideId: "s", type: "content", projector: { headline: "Úvod" }, blocks: [] };
    const activity = { type: "activity", projector: { headline: "AI otázka" }, activitySpec: { activityType: "mcq", question: "AI otázka" }, ai_generated: true, ai_modified_at: "2026-11-22T01:00:00Z" };
    expect(buildPresetIntoSlide(current, activity)).toMatchObject({ ai_generated: true, ai_modified_at: "2026-11-22T01:00:00Z" });
  });
  it("najde i vnořené aktivity ve sloupcích a skupinách", () => {
    const blocks = [
      { id: "1", type: "activity", props: { activityType: "quiz" } },
      { id: "2", type: "slide_group", props: { children: [{ id: "3", type: "activity", props: { activityType: "matching" } }, { id: "4", type: "slide_group", props: { children: [{ id: "5", type: "activity", props: { activityType: "ordering" } }] } }] } },
      { id: "6", type: "paragraph", props: { text: "x" } },
    ];
    expect(collectActivityBlocks(blocks).map((f) => f.block.id)).toEqual(["1", "3", "5"]);
  });
  it("aktivity ze Studia: jen kroky s aktivitou, kopie má nové ID", () => {
    const t = [{ id: "t", title: "Sada", activity_data: [{ slideId: "a", type: "activity", activitySpec: { activityType: "mcq", question: "Q" } }, { slideId: "b", type: "content" }] }];
    const found = collectStudioActivities(t);
    expect(found.map((f) => f.title)).toEqual(["Q"]);
    expect(cloneStudioSlide(found[0].slide).slideId).not.toBe("a");
  });
  it("odkaz na lekci drží vždy první slide", () => {
    const slides = attachLessonRef([{ slideId: "1" }, { slideId: "2" }], { id: "L", title: "Voda", source: "teacher" });
    expect(readLessonRef(slides)).toEqual({ id: "L", title: "Voda", source: "teacher" });
    const moved = attachLessonRef([slides[1], slides[0]], readLessonRef(slides));
    expect(moved[0].lessonRef.id).toBe("L");
    expect(moved[1].lessonRef).toBeUndefined();
  });
  it("klávesy v promítání: šipky a PageUp/PageDown, ne při psaní", () => {
    expect(slideKeyDirection("ArrowRight")).toBe(1);
    expect(slideKeyDirection("PageUp")).toBe(-1);
    expect(slideKeyDirection("a")).toBe(0);
    const input = document.createElement("input");
    expect(isTypingTarget(input)).toBe(true);
    expect(isTypingTarget(document.createElement("div"))).toBe(false);
  });
});

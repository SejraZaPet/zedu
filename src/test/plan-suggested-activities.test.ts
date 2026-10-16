import { describe, it, expect } from "vitest";
import {
  CREATABLE_KINDS,
  createdHref,
  buildWorksheetSpecFromAi,
  buildGameSlidesFromQuiz,
  ACTIVITIES_HREF,
  GAMES_HREF,
} from "@/lib/plan-suggested-activities";
import { ACTIVITY_ROUTES_EXIST } from "./plan-suggested-activities.routes";

describe("plan-suggested-activities", () => {
  it("vytvářet lze jen kvíz, pracovní list a živou hru", () => {
    expect([...CREATABLE_KINDS].sort()).toEqual(["live_game", "quiz", "worksheet"]);
  });

  it("odkazy míří na existující cesty (žádné 404)", () => {
    // /ucitel/aktivity neexistuje – správná cesta je /aktivity
    expect(ACTIVITIES_HREF).toBe("/aktivity");
    expect(GAMES_HREF).toBe("/ucitel/hry");
    expect(ACTIVITY_ROUTES_EXIST).toContain("/aktivity");
    expect(ACTIVITY_ROUTES_EXIST).toContain("/ucitel/hry");
    expect(ACTIVITY_ROUTES_EXIST).toContain("/ucitel/pracovni-listy/:id");
    expect(ACTIVITY_ROUTES_EXIST).toContain("/live/ucitel/:sessionId");
  });

  it("createdHref: list → editor, hra → knihovna her", () => {
    expect(createdHref({ type: "worksheet", id: "w1" })).toBe("/ucitel/pracovni-listy/w1");
    expect(createdHref({ type: "game_template", id: "g1" })).toBe("/ucitel/hry");
  });

  it("buildWorksheetSpecFromAi sestaví koncept s klíčem odpovědí", () => {
    const spec = buildWorksheetSpecFromAi("Opakování – Poživatiny", [
      { type: "mcq", prompt: "Co je bílkovina?", choices: ["A", "B", "C", "D"], correctAnswer: "A", points: 2 },
      { type: "short_answer", prompt: "Uveď příklad.", points: 1 },
    ]);
    expect(spec.header.title).toBe("Opakování – Poživatiny");
    expect(spec.header.worksheetMode).toBe("classwork");
    expect(spec.variants[0].items).toHaveLength(2);
    expect(spec.variants[0].items[0].itemNumber).toBe(1);
    expect(spec.variants[0].items[1].itemNumber).toBe(2);
    // id z AI odpovědi se nepřebíjí – vždy se vygeneruje nové
    expect(spec.variants[0].items[0].id).toBeTruthy();
    const keys = spec.answerKeys[spec.variants[0].variantId];
    expect(keys).toHaveLength(2);
    expect(keys[0].correctAnswer).toBe("A");
    expect(spec.metadata.totalPoints).toBe(3);
  });

  it("buildWorksheetSpecFromAi zvládne prázdný výstup", () => {
    const spec = buildWorksheetSpecFromAi("Prázdný", []);
    expect(spec.variants[0].items).toHaveLength(0);
    expect(spec.metadata.totalPoints).toBe(0);
  });

  it("buildGameSlidesFromQuiz sestaví slidy a přeskočí neplatné otázky", () => {
    const slides = buildGameSlidesFromQuiz([
      { question: "Otázka 1?", answers: ["a", "b", "c", "d"], correctIndex: 1 },
      { question: "", answers: ["a", "b"], correctIndex: 0 } as any,
    ]);
    expect(slides).toHaveLength(1);
    expect(slides[0].type).toBe("activity");
    expect(slides[0].activitySpec.activityType).toBe("mcq");
    expect(slides[0].activitySpec.options[1].correct).toBe(true);
    expect(slides[0].ai_generated).toBe(true);
  });
});

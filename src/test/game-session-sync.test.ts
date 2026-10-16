import { describe, it, expect } from "vitest";
import {
  extractLightState,
  lightStateChanged,
  applyLightSessionState,
  rowSlidesLength,
} from "@/lib/game-session-sync";

describe("game-session-sync (lehký stav živé hry)", () => {
  it("extractLightState vytáhne jen status, index otázky a čas startu", () => {
    const row = {
      status: "playing",
      current_question_index: 3,
      question_started_at: "2026-10-16T07:00:00Z",
      activity_data_safe: [{ q: "?", answers: [{ text: "a" }] }],
      settings: { gameMode: "classic" },
    };
    expect(extractLightState(row)).toEqual({
      status: "playing",
      current_question_index: 3,
      question_started_at: "2026-10-16T07:00:00Z",
    });
  });

  it("extractLightState odmítne neplatný řádek", () => {
    expect(extractLightState(null)).toBeNull();
    expect(extractLightState({})).toBeNull();
    expect(extractLightState({ current_question_index: 1 })).toBeNull();
  });

  it("lightStateChanged pozná změnu otázky i fáze hry", () => {
    const prev = { status: "playing", current_question_index: 1, question_started_at: "t1" };
    expect(lightStateChanged(prev, { status: "playing", current_question_index: 1, question_started_at: "t1" })).toBe(false);
    expect(lightStateChanged(prev, { status: "playing", current_question_index: 2, question_started_at: "t2" })).toBe(true);
    expect(lightStateChanged(prev, { status: "finished", current_question_index: 1, question_started_at: "t1" })).toBe(true);
  });

  it("applyLightSessionState přepíše jen lehká pole, nikdy activity_data", () => {
    const prev = {
      status: "playing",
      current_question_index: 1,
      question_started_at: "t1",
      activity_data: [{ q: "Bezpečný snímek" }],
      settings: { gameMode: "race" },
      teams: { teams: [] },
    };
    const next = applyLightSessionState(prev as any, {
      status: "playing",
      current_question_index: 2,
      question_started_at: "t2",
    }) as any;
    expect(next.current_question_index).toBe(2);
    expect(next.question_started_at).toBe("t2");
    expect(next.activity_data).toBe(prev.activity_data);
    expect(next.settings).toBe(prev.settings);
  });

  it("beze změny vrátí stejný objekt (žádné zbytečné překreslení)", () => {
    const prev = { status: "playing", current_question_index: 1, question_started_at: "t1" };
    const light = { status: "playing", current_question_index: 1, question_started_at: "t1" };
    expect(applyLightSessionState(prev as any, light)).toBe(prev);
  });

  it("hráč bez účtu: změna otázky z pollingu se projeví bez realtime události", () => {
    // Simulace: realtime nic nedodal (RLS filtr), dorazí jen odpověď get_player_session.
    const prev = { status: "playing", current_question_index: 0, question_started_at: "t0", activity_data: [1, 2, 3] };
    const row = { status: "playing", current_question_index: 1, question_started_at: "t1", activity_data_safe: [1, 2, 3] };
    const light = extractLightState(row)!;
    const next = applyLightSessionState(prev as any, light) as any;
    expect(next.current_question_index).toBe(1);
    expect(next.activity_data).toEqual([1, 2, 3]);
  });

  it("přihlášený hráč: ukončení hry dojde přes polling", () => {
    const prev = { status: "playing", current_question_index: 4, question_started_at: "t4" };
    const light = extractLightState({ status: "finished", current_question_index: 4, question_started_at: "t4" })!;
    const next = applyLightSessionState(prev as any, light) as any;
    expect(next.status).toBe("finished");
  });

  it("rowSlidesLength čte activity_data_safe i activity_data", () => {
    expect(rowSlidesLength({ activity_data_safe: [1, 2] })).toBe(2);
    expect(rowSlidesLength({ activity_data: [1] })).toBe(1);
    expect(rowSlidesLength({})).toBe(-1);
  });
});

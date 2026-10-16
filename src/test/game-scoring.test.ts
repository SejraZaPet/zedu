import { describe, it, expect } from "vitest";
import {
  GAME_RULES, classicScore, computeScore, correctStreak, effectiveMode, mcqCorrectFromSelection,
  pickVictim, stealAmount, stealCandidates, teamsActiveFor, type GameModeId, type Opponent,
} from "../../supabase/functions/_shared/game-scoring";
import { expandSlidesForLiveGame } from "@/lib/live-game-expand";

const base = { elapsedMs: 0, timeLimitMs: 20000, myScore: 0, streak: 1, victim: null };

describe("bodování podle režimu", () => {
  it("klasický: 1000 hned, 400 na konci, 0 za chybu", () => {
    expect(classicScore(true, 0, 20000)).toBe(1000);
    expect(classicScore(true, 20000, 20000)).toBe(400);
    expect(classicScore(true, 10000, 20000)).toBe(700);
    expect(classicScore(false, 0, 20000)).toBe(0);
  });
  it("závod 10, věž 1, chyba 0", () => {
    expect(computeScore({ ...base, mode: "race", correct: true }).score).toBe(10);
    expect(computeScore({ ...base, mode: "tower", correct: true }).score).toBe(1);
    expect(computeScore({ ...base, mode: "tower", correct: false }).score).toBe(0);
  });
  it("režim snímku přebije hru, kromě závodu", () => {
    expect(effectiveMode("standard", "steal")).toBe("steal");
    expect(effectiveMode("race", "steal")).toBe("race");
    expect(effectiveMode("tower", "race")).toBe("tower");
    expect(effectiveMode(undefined, undefined)).toBe("standard");
  });
});

describe("krádež bodů", () => {
  it("10 %, min 50, max 300, ne víc než oběť má", () => {
    expect(stealAmount(1000, false)).toBe(100);
    expect(stealAmount(200, false)).toBe(50);
    expect(stealAmount(30, false)).toBe(30);
    expect(stealAmount(10000, false)).toBe(300);
    expect(stealAmount(0, false)).toBe(0);
  });
  it("lupič (3 v řadě) krade dvojnásobek", () => {
    expect(correctStreak([true, true, false], true)).toBe(3);
    expect(correctStreak([true], false)).toBe(0);
    expect(stealAmount(1000, true)).toBe(200);
    const r = computeScore({ ...base, mode: "steal", correct: true, streak: 3, victim: { id: "v", total_score: 1000 } });
    expect(r).toMatchObject({ score: 300, victimId: "v", victimDelta: -200, robber: true });
  });
  it("chyba −100, ale ne pod nulu", () => {
    expect(computeScore({ ...base, mode: "steal", correct: false, myScore: 500 }).score).toBe(-100);
    expect(computeScore({ ...base, mode: "steal", correct: false, myScore: 40 }).score).toBe(-40);
  });
  it("nekrade spoluhráčům ani sobě; oběť je vedoucí soupeř", () => {
    const others: Opponent[] = [{ id: "me", total_score: 900 }, { id: "mate", total_score: 800 }, { id: "a", total_score: 300 }, { id: "b", total_score: 0 }];
    const teams = [{ id: "t1", members: ["me", "mate"] }, { id: "t2", members: ["a", "b"] }];
    const pool = stealCandidates("me", others, teams, true);
    expect(pool.map((o) => o.id)).toEqual(["a", "b"]);
    expect(pickVictim(pool)?.id).toBe("a");
    expect(pickVictim(stealCandidates("me", others, teams, false))?.id).toBe("mate");
    expect(pickVictim([{ id: "x", total_score: 0 }])).toBeNull();
  });
  it("týmy aktivní podle nastavení hry nebo snímku", () => {
    expect(teamsActiveFor({}, { teamModeKind: "random" })).toBe(true);
    expect(teamsActiveFor({}, { teamModeKind: "none" })).toBe(false);
    expect(teamsActiveFor({ gameSettings: { teamMode: "none" } }, { teamModeKind: "manual" })).toBe(false);
  });
});

describe("ověření MCQ na serveru", () => {
  const opts = [{ text: "A" }, { text: "B", correct: true }];
  it("správnost ze zvolených indexů", () => {
    expect(mcqCorrectFromSelection(opts, [1])).toBe(true);
    expect(mcqCorrectFromSelection(opts, [0])).toBe(false);
    expect(mcqCorrectFromSelection(opts, [0, 1])).toBe(false);
    expect(mcqCorrectFromSelection(opts, undefined)).toBeNull();
    expect(mcqCorrectFromSelection([{ text: "A" }], [0])).toBeNull();
  });
});

describe("integrace: celá hra se 3 hráči", () => {
  // Simulace serveru: převod snímků → odpovědi → body podle režimu → žebříček.
  const slides = expandSlidesForLiveGame([
    { slideId: "tf", type: "activity", activitySpec: { activityType: "true_false", trueFalse: { statements: [
      { text: "1", isTrue: true }, { text: "2", isTrue: false }, { text: "3", isTrue: true }, { text: "4", isTrue: true }] } } },
  ]);
  // Hráči odpovídají: Ana vždy správně, Ben jen první dvě, Cyril nikdy.
  const choose = (p: string, qi: number, ci: number) => (p === "ana" || (p === "ben" && qi < 2) ? ci : 1 - ci);

  function play(mode: GameModeId, teams?: { id: string; members: string[] }[]) {
    const score: Record<string, number> = { ana: 0, ben: 0, cyril: 0 };
    const hist: Record<string, boolean[]> = { ana: [], ben: [], cyril: [] };
    slides.forEach((s, qi) => {
      for (const p of ["ana", "ben", "cyril"]) {
        const sel = choose(p, qi, s.activitySpec.correctIndex);
        const correct = mcqCorrectFromSelection(s.activitySpec.options, [sel])!;
        const streak = correctStreak([...hist[p]].reverse(), correct);
        const opp = Object.entries(score).map(([id, total_score]) => ({ id, total_score }));
        const victim = pickVictim(stealCandidates(p, opp, teams, !!teams));
        const r = computeScore({ mode, correct, elapsedMs: 5000, timeLimitMs: 20000, myScore: score[p], streak, victim });
        score[p] += r.score;
        if (r.victimId) score[r.victimId] += r.victimDelta;
        hist[p].push(correct);
      }
    });
    return score;
  }

  it("převod dá 4 otázky Pravda/Nepravda", () => {
    expect(slides).toHaveLength(4);
    expect(slides.every((s) => s.activitySpec.options.length === 2)).toBe(true);
  });
  it("klasický: pořadí Ana > Ben > Cyril, skóre podle rychlosti", () => {
    const s = play("standard");
    expect(s).toEqual({ ana: 4 * 850, ben: 2 * 850, cyril: 0 });
  });
  it("věž a závod sčítají správné odpovědi", () => {
    expect(play("tower")).toEqual({ ana: 4, ben: 2, cyril: 0 });
    expect(play("race")).toEqual({ ana: 40, ben: 20, cyril: 0 });
  });
  it("krádež: body se přesouvají, nikdo neklesne pod nulu, součet sedí", () => {
    const s = play("steal");
    Object.values(s).forEach((v) => expect(v).toBeGreaterThanOrEqual(0));
    expect(s.ana).toBeGreaterThan(s.ben);
    expect(s.cyril).toBe(0);
  });
  it("týmy: spoluhráč není oběť", () => {
    const s = play("steal", [{ id: "t1", members: ["ana", "ben"] }, { id: "t2", members: ["cyril"] }]);
    // Ana a Ben si nekradou; Cyril nemá body, takže se nekrade nic.
    expect(s.ana).toBe(4 * GAME_RULES.steal.base);
    expect(s.ben).toBe(2 * GAME_RULES.steal.base);
  });
});

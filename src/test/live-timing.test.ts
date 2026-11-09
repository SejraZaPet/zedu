import { describe, it, expect } from "vitest";
import {
  resolveTimeLimitSec, scoringTimeLimitMs, isAwaitingStart, settingsForSlideEnter, settingsForStart,
  DEFAULT_NEW_QUIZ_TIME_SEC,
} from "../../supabase/functions/_shared/live-timing";
import { liveQuestionTimeLimitMs } from "@/lib/live-mcq";
import { expandSlidesForLiveGame } from "@/lib/live-game-expand";
import { timeLimitSelectValue } from "@/components/live/TimeLimitPicker";

const mcq = (spec: Record<string, unknown> = {}) => ({ type: "activity", activitySpec: { activityType: "mcq", ...spec } });
const text = { type: "explain", projector: { headline: "x", body: "" } };

describe("čas na odpověď – stará data beze změny", () => {
  it("klasická hra bez nastavení = 20 s", () => {
    expect(resolveTimeLimitSec({ question: "q" }, {}, "classic")).toBe(20);
    expect(resolveTimeLimitSec({ question: "q" }, { timePerQuestion: 0 }, "classic")).toBe(20);
    expect(resolveTimeLimitSec({ question: "q" }, { timePerQuestion: 45 }, "classic")).toBe(45);
  });
  it("bodování bez pole: slide.timeLimit → hra → 20 s", () => {
    expect(scoringTimeLimitMs(mcq(), {})).toBe(20000);
    expect(scoringTimeLimitMs({ ...mcq(), timeLimit: 15 }, { timePerQuestion: 30 })).toBe(15000);
    expect(scoringTimeLimitMs(mcq(), { timePerQuestion: 30 })).toBe(30000);
  });
  it("živá prezentace bez pole: čas hry, 0 = bez odpočtu", () => {
    expect(liveQuestionTimeLimitMs({ timePerQuestion: 30 }, mcq())).toBe(30000);
    expect(liveQuestionTimeLimitMs({ timePerQuestion: 0 }, mcq())).toBeNull();
    expect(liveQuestionTimeLimitMs({ timePerQuestion: 25 })).toBe(25000);
  });
});

describe("čas na odpověď nastavený na slidu", () => {
  it("má přednost před hrou", () => {
    expect(liveQuestionTimeLimitMs({ timePerQuestion: 20 }, mcq({ timeLimitSec: 90 }))).toBe(90000);
    expect(resolveTimeLimitSec(mcq({ timeLimitSec: 60 }), { timePerQuestion: 20 }, "scoring")).toBe(60);
  });
  it("bez limitu vypne odpočet i auto-odhalení, bodování zůstává jako dřív", () => {
    expect(liveQuestionTimeLimitMs({ timePerQuestion: 30 }, mcq({ timeLimitSec: 0 }))).toBeNull();
    expect(scoringTimeLimitMs(mcq({ timeLimitSec: 0 }), { timePerQuestion: 30 })).toBe(20000);
  });
  it("výchozí čas nového kvízu je 30 s", () => {
    expect(DEFAULT_NEW_QUIZ_TIME_SEC).toBe(30);
  });
  it("rozbalené otázky z pravda/nepravda převezmou čas slidu", () => {
    const out = expandSlidesForLiveGame([{ type: "activity", activitySpec: { activityType: "true_false", timeLimitSec: 45, trueFalse: { statements: [{ text: "A", isTrue: true }, { text: "B", isTrue: false }] } } }]);
    expect(out).toHaveLength(2);
    expect(out.every((s) => s.activitySpec.timeLimitSec === 45)).toBe(true);
  });
  it("výběr v editoru rozpozná uložené hodnoty", () => {
    expect(timeLimitSelectValue(undefined)).toBe("inherit");
    expect(timeLimitSelectValue(0)).toBe("none");
    expect(timeLimitSelectValue(45)).toBe("45");
    expect(timeLimitSelectValue(40)).toBe("custom");
  });
});

describe("ruční „Spustit“", () => {
  const slides = [text, mcq(), { type: "activity", activitySpec: { activityType: "wall" } }];
  it("v ručním režimu se aktivita při příchodu připraví a nečeká textový slide", () => {
    const manual = { activityStartMode: "manual" };
    expect(settingsForSlideEnter(manual, slides, 1).armedQuestion).toBe(1);
    expect(settingsForSlideEnter(manual, slides, 2).armedQuestion).toBe(2);
    expect("armedQuestion" in settingsForSlideEnter({ ...manual, armedQuestion: 1 }, slides, 0)).toBe(false);
  });
  it("žák nemůže odpovídat před spuštěním (stejné pravidlo jako server)", () => {
    const s = settingsForSlideEnter({ activityStartMode: "manual" }, slides, 1);
    expect(isAwaitingStart(s, slides[1], 1)).toBe(true);
    expect(isAwaitingStart(settingsForStart(s), slides[1], 1)).toBe(false);
  });
  it("automatický režim a staré hry bez pole se spouští hned", () => {
    expect("armedQuestion" in settingsForSlideEnter({}, slides, 1)).toBe(false);
    expect("armedQuestion" in settingsForSlideEnter({ activityStartMode: "auto" }, slides, 1)).toBe(false);
    expect(isAwaitingStart({}, slides[1], 1)).toBe(false);
  });
  it("závod a tempo žáka se nemění", () => {
    expect("armedQuestion" in settingsForSlideEnter({ activityStartMode: "manual", gameMode: "race" }, slides, 1)).toBe(false);
    expect(isAwaitingStart({ armedQuestion: 1, pacingMode: "student" }, slides[1], 1)).toBe(false);
    expect(isAwaitingStart({ armedQuestion: 1, gameMode: "race" }, slides[1], 1)).toBe(false);
  });
  it("připravený je jen ten konkrétní slide", () => {
    expect(isAwaitingStart({ armedQuestion: 1 }, slides[2], 2)).toBe(false);
  });
});

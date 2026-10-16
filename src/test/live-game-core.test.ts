import { describe, it, expect } from "vitest";
import { activityToCoreQuestions, coreToGameQuestions, isLiveGameActivity } from "@/lib/live-game-core";
import { expandSlidesForLiveGame } from "@/lib/live-game-expand";
import { GAME_RULES } from "../../supabase/functions/_shared/game-scoring";
import { getModeDef } from "@/lib/game-modes";

const tf = { activityType: "true_false", trueFalse: { statements: [{ text: "A", isTrue: true }, { text: "B", isTrue: false }] } };

describe("jedno jádro pro /hra i /live", () => {
  it("Pravda/Nepravda: stejné otázky v obou cestách", () => {
    const a = coreToGameQuestions(activityToCoreQuestions(tf));
    const b = expandSlidesForLiveGame([{ slideId: "a", type: "activity", activitySpec: tf }]);
    expect(a).toHaveLength(2);
    expect(a[1]).toMatchObject({ question: "B", type: "true_false", answers: [{ text: "Pravda", correct: false }, { text: "Nepravda", correct: true }] });
    expect(b.map((s) => s.activitySpec.correctIndex)).toEqual(a.map((q) => q.answers.findIndex((x) => x.correct)));
  });
  it("doplňovačka s výběrem: jedna otázka na mezeru, ne první volba jako správná", () => {
    const q = activityToCoreQuestions({ activityType: "fill_choice", fillChoice: {
      tokens: [{ type: "text", value: "Pes " }, { type: "blank", answer: "štěká" }, { type: "text", value: "." }], options: ["mňouká", "štěká"] } });
    expect(q).toHaveLength(1);
    expect(q[0].answers[q[0].correctIndex]).toBe("štěká");
  });
  it("spojování a seřazení jdou hrát, kartičky ne", () => {
    expect(activityToCoreQuestions({ activityType: "matching", matching: { left: ["x", "y"], right: ["1", "2"] } })).toHaveLength(2);
    expect(activityToCoreQuestions({ activityType: "ordering", title: "Kroky", ordering: { items: ["a", "b", "c"] } })).toHaveLength(3);
    expect(isLiveGameActivity("flashcards")).toBe(false);
    expect(activityToCoreQuestions({ activityType: "flashcards" })).toEqual([]);
  });
  it("popisy režimů odpovídají pravidlům serveru", () => {
    expect(getModeDef("race").scoringHint).toContain(String(GAME_RULES.race.correct));
    expect(getModeDef("steal").scoringHint).toContain(String(GAME_RULES.steal.base));
    expect(getModeDef("steal").scoringHint).toContain(`−${GAME_RULES.steal.wrongPenalty}`);
    expect(getModeDef("standard").scoringHint).toContain(`${GAME_RULES.classic.min}`);
  });
});

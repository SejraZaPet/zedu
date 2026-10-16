import { describe, it, expect } from "vitest";
import { activityToGameQuestions, liveGameUnsupportedReason, WIZARD_TYPES } from "@/lib/activity-wizard";
import { buildGameSlidesFromQuiz } from "@/lib/plan-suggested-activities";

describe("převod aktivity na živou hru", () => {
  it("Pravda/Nepravda: výrok = otázka, správná Pravda nebo Nepravda", () => {
    const q = activityToGameQuestions({ activityType: "true_false", trueFalse: { statements: [
      { text: "Voda vře při 100 °C", isTrue: true }, { text: "<b>Slunce</b> je planeta", isTrue: false },
      { text: "", isTrue: true }, { text: "Bez určení" },
    ] } });
    expect(q).toEqual([
      { question: "Voda vře při 100 °C", answers: ["Pravda", "Nepravda"], correctIndex: 0 },
      { question: "Slunce je planeta", answers: ["Pravda", "Nepravda"], correctIndex: 1 },
    ]);
    const slides = buildGameSlidesFromQuiz(q);
    expect(slides[1].activitySpec.options[1].correct).toBe(true);
    expect(slides[1].activitySpec.question).toBe("Slunce je planeta");
  });

  it("Spojování: každá dvojice je otázka se správnou odpovědí", () => {
    const q = activityToGameQuestions({ activityType: "matching", matching: { left: ["A", "B", "C"], right: ["1", "2", "3"] } });
    expect(q).toHaveLength(3);
    q.forEach((x, i) => {
      expect(x.answers[x.correctIndex]).toBe(["1", "2", "3"][i]);
      expect(new Set(x.answers).size).toBe(x.answers.length);
    });
    expect(activityToGameQuestions({ activityType: "matching", matching: { left: ["A"], right: ["1"] } })).toEqual([]);
  });

  it("kvíz zachová správnou odpověď a neplatná data nespadnou", () => {
    const q = activityToGameQuestions({ activityType: "quiz", quiz: { questions: [{ question: "2+2?", answers: [{ text: "3" }, { text: "4", correct: true }] }] } });
    expect(q[0].correctIndex).toBe(1);
    expect(activityToGameQuestions({ activityType: "true_false" })).toEqual([]);
    expect(activityToGameQuestions(null)).toEqual([]);
  });

  it("nehratelné typy mají důvod a v průvodci nejsou jako hra", () => {
    expect(liveGameUnsupportedReason("ordering")).toBe("Tuto aktivitu nelze hrát jako živou hru");
    expect(liveGameUnsupportedReason("true_false")).toBeNull();
    expect(WIZARD_TYPES.truefalse.liveGame).toBe(true);
    expect(WIZARD_TYPES.ordering.liveGame).toBe(false);
  });
});

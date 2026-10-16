import { describe, it, expect } from "vitest";
import { expandSlidesForLiveGame, placeAnswer } from "@/lib/live-game-expand";

const sp = (activitySpec: any) => ({ slideId: "s", type: "activity", projector: { headline: "H" }, activitySpec });
const correct = (s: any) => s.activitySpec.options[s.activitySpec.correctIndex].text;

describe("expandSlidesForLiveGame", () => {
  it("Pravda/Nepravda → jedna otázka na snímek s volbami Pravda/Nepravda", () => {
    const out = expandSlidesForLiveGame([sp({ activityType: "true_false", trueFalse: { statements: [{ text: "A", isTrue: true }, { statement: "<b>B</b>", correct: false }] } })]);
    expect(out).toHaveLength(2);
    expect(out[0].activitySpec.options.map((o: any) => o.text)).toEqual(["Pravda", "Nepravda"]);
    expect(correct(out[0])).toBe("Pravda");
    expect(out[1].projector.headline).toBe("B");
    expect(correct(out[1])).toBe("Nepravda");
  });
  it("spojování → otázka pro každou dvojici", () => {
    const out = expandSlidesForLiveGame([sp({ activityType: "matching", matching: { left: ["a", "b", "c"], right: ["1", "2", "3"] } })]);
    expect(out.map(correct)).toEqual(["1", "2", "3"]);
  });
  it("doplňovačka → otázka pro každou mezeru", () => {
    const out = expandSlidesForLiveGame([sp({ activityType: "fill_blanks", fillBlanks: { text: "{{Praha}} je v {{Česku}}." } })]);
    expect(out).toHaveLength(2);
    expect(out[0].projector.headline).toBe("Doplň: ____ je v Česku.");
    expect(out.map(correct)).toEqual(["Praha", "Česku"]);
  });
  it("seřazení → otázka pro každou pozici", () => {
    const out = expandSlidesForLiveGame([sp({ activityType: "ordering", ordering: { items: ["x", "y", "z"] } })]);
    expect(out.map(correct)).toEqual(["x", "y", "z"]);
  });
  it("ostatní snímky a neplatná data beze změny, idempotentní", () => {
    const poll = sp({ activityType: "poll" });
    const bad = sp({ activityType: "matching", matching: { left: ["a"], right: ["1"] } });
    const once = expandSlidesForLiveGame([poll, bad, sp({ activityType: "true_false", trueFalse: { statements: [{ text: "A", isTrue: true }] } })]);
    expect(once[0]).toBe(poll); expect(once[1]).toBe(bad);
    expect(expandSlidesForLiveGame(once)).toEqual(once);
  });
  it("placeAnswer je deterministické a obsahuje správnou odpověď", () => {
    const a = placeAnswer("x", ["x", "y", "z"], 1);
    expect(a).toEqual(placeAnswer("x", ["x", "y", "z"], 1));
    expect(a.answers[a.correctIndex]).toBe("x");
  });
});

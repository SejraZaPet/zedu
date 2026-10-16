import { describe, it, expect } from "vitest";
import { answerDistribution, classSuccessSummary, computeParticipantStats, isGradedSlide, pct } from "../../supabase/functions/_shared/session-participants";
import { sortParticipants } from "@/lib/session-participants-sort";

const mcq = (correct: number) => ({ type: "activity", activitySpec: { activityType: "mcq", options: [0, 1, 2].map((i) => ({ text: `O${i}`, correct: i === correct })) } });
const slides = [{ type: "content" }, mcq(1), mcq(0), { type: "activity", activitySpec: { activityType: "poll" } }];
const r = (p: string, q: number, ok: boolean, t = 1000, sel = 0) => ({ player_id: p, question_index: q, is_correct: ok, response_time_ms: t, answer: { selected: [sel] } });

describe("úspěšnost účastníků živé hry", () => {
  it("pct ošetří dělení nulou", () => {
    expect(pct(3, 4)).toBe(75);
    expect(pct(0, 0)).toBeNull();
  });
  it("hodnocené jsou jen aktivity se správnou odpovědí", () => {
    expect(slides.map(isGradedSlide)).toEqual([false, true, true, false]);
  });
  it("úspěšnost = správně / hodnocené odpovědi, anketa se nepočítá", () => {
    const st = computeParticipantStats(slides, [{ id: "a", total_score: 900 }, { id: "b" }, { id: "c" }],
      [r("a", 1, true, 1000), r("a", 2, false, 3000), r("a", 3, false), r("b", 1, true), r("b", 2, true)]);
    expect(st[0]).toMatchObject({ correct: 1, graded: 2, successRate: 50, score: 900 });
    expect(st[1].successRate).toBe(100);
    expect(st[2]).toMatchObject({ graded: 0, successRate: null, avgTimeMs: null });
    expect(classSuccessSummary(st)).toEqual({ averageSuccessRate: 75, needHelpCount: 0, ratedCount: 2 });
  });
  it("pod 50 % se počítá do pomoci", () => {
    const st = computeParticipantStats(slides, [{ id: "a" }], [r("a", 1, false), r("a", 2, false)]);
    expect(classSuccessSummary(st).needHelpCount).toBe(1);
  });
  it("rozložení odpovědí označí správnou možnost", () => {
    const d = answerDistribution(mcq(1), [r("a", 1, true, 0, 1), r("b", 1, false, 0, 0), r("c", 1, true, 0, 1)]);
    expect(d.map((x) => [x.count, x.correct])).toEqual([[1, false], [2, true], [0, false]]);
    expect(answerDistribution({ type: "activity", activitySpec: {} }, [])).toEqual([]);
  });
  it("řazení: bez odpovědí („–“) jsou na konci", () => {
    const s = sortParticipants([{ name: "B", successRate: null, score: 0 }, { name: "A", successRate: 40, score: 5 }, { name: "C", successRate: 90, score: 1 }], "success");
    expect(s.map((x) => x.name)).toEqual(["C", "A", "B"]);
    expect(sortParticipants(s, "name").map((x) => x.name)).toEqual(["A", "B", "C"]);
  });
});

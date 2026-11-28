import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { computeWeakSlides, projectorWeakItems, slideSuccess } from "@/components/game/AdaptiveReview";

const q = (question: string, activityType = "quiz") => ({ type: "activity", activitySpec: { activityType, question } });
const slides = [
  { type: "content" },
  q("Q1"),
  q("Q2"),
  q("Zeď", "wall"),
  q("Anketa", "poll"),
  q("Bez odpovědí"),
  q("Q6"),
];
const r = (question_index: number, is_correct: boolean | null, score: number | null) => ({ question_index, is_correct, score });

describe("adaptivní závěr – úspěšnost", () => {
  it("vše správně: žádná slabá otázka (body 1000 nejsou procenta)", () => {
    expect(computeWeakSlides(slides, [r(1, true, 1000), r(1, true, 640)])).toEqual([]);
  });
  it("část chybně: 1 ze 2 = 50 %", () => {
    const weak = computeWeakSlides(slides, [r(1, true, 900), r(1, false, 0)]);
    expect(weak.map((w) => [w.index, w.successPct, w.total])).toEqual([[1, 50, 2]]);
  });
  it("is_correct false i score 0 se počítají jako chyba", () => {
    expect(slideSuccess([r(2, false, 500), r(2, null, 0)], 2)).toEqual({ total: 2, pct: 0 });
  });
  it("wall/poll a otázky bez odpovědí se přeskočí", () => {
    const weak = computeWeakSlides(slides, [r(3, false, 0), r(4, false, 0)]);
    expect(weak).toEqual([]);
  });
  it("řazení od nejhorší", () => {
    const weak = computeWeakSlides(slides, [
      r(1, true, 1), r(1, false, 0), r(1, false, 0), // 33 %
      r(2, false, 0), // 0 %
      r(6, true, 1), r(6, true, 1), r(6, true, 1), r(6, false, 0), // 75 %
    ]);
    expect(weak.map((w) => w.index)).toEqual([2, 1, 6]);
  });
  it("projektor počítá stejně jako dialog, nikdy přes 100 %", () => {
    const responses = [r(1, true, 950), r(1, false, 0), r(6, true, 800), r(6, true, 640), r(6, false, 0)];
    const dialog = computeWeakSlides(slides, responses);
    const projector = projectorWeakItems(slides, responses, dialog.map((w) => w.index));
    expect(projector.map((p) => [p.index, p.successPct])).toEqual([[1, 50], [6, 67]]);
    expect(projector.map((p) => p.successPct)).toEqual(dialog.map((d) => d.successPct));
    expect(projector.every((p) => p.successPct <= 100)).toBe(true);
  });
  it("projektor bez vybraných indexů použije výpočet dialogu", () => {
    const responses = [r(2, false, 0)];
    expect(projectorWeakItems(slides, responses, [])).toEqual(computeWeakSlides(slides, responses));
  });
});

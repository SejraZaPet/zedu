import { describe, expect, it } from "vitest";
import {
  deletePresentationSlides,
  duplicatePresentationSlides,
  movePresentationSlidesToEdge,
  setPresentationSlidesHidden,
  visiblePresentationSlides,
} from "@/lib/presentation-slide-actions";
import { readLessonRef } from "@/lib/presentation-lesson-ref";

const slides = () => [
  { slideId: "a", projector: { headline: "A" }, lessonRef: { id: "lesson-1", title: "Lekce", source: "teacher" } },
  { slideId: "b", type: "activity", activitySpec: { activityType: "mcq" }, blocks: [{ id: "old" }] },
  { slideId: "c", projector: { headline: "C" } },
  { slideId: "d", projector: { headline: "D" } },
  { slideId: "e", projector: { headline: "E" } },
];

describe("presentation slide actions", () => {
  it("smaže slide, aktivitu i obsah a zachová lessonRef na novém prvním slidu", () => {
    const input = slides();
    const result = deletePresentationSlides(input, [0], 0)!;
    expect(result.slides.map((s) => s.slideId)).toEqual(["b", "c", "d", "e"]);
    expect(readLessonRef(result.slides)).toEqual({ id: "lesson-1", title: "Lekce", source: "teacher" });
    expect(result.activeIndex).toBe(0);
    expect(input).toHaveLength(5);
  });

  it("odebere slide s aktivitou bez zvláštního datového modelu", () => {
    const result = deletePresentationSlides(slides(), [1], 1)!;
    expect(result.slides.some((s) => s.slideId === "b")).toBe(false);
    expect(result.activeIndex).toBe(0);
  });

  it("nedovolí smazat poslední ani všechny vybrané slidy", () => {
    expect(deletePresentationSlides([slides()[0]], [0], 0)).toBeNull();
    expect(deletePresentationSlides(slides(), [0, 1, 2, 3, 4], 0)).toBeNull();
  });

  it("hromadně smaže jen vybrané a aktivní slide přepočítá", () => {
    const result = deletePresentationSlides(slides(), [1, 3], 4)!;
    expect(result.slides.map((s) => s.slideId)).toEqual(["a", "c", "e"]);
    expect(result.activeIndex).toBe(2);
  });

  it("duplikuje více slidů za originály s novými ID a jedním lessonRef", () => {
    const result = duplicatePresentationSlides(slides(), [0, 1], 1)!;
    expect(result.slides).toHaveLength(7);
    expect(result.selectedIndices).toEqual([1, 3]);
    expect(result.slides[3].slideId).not.toBe("b");
    expect(result.slides[3].blocks[0].id).not.toBe("old");
    expect(result.slides.filter((s) => s.lessonRef)).toHaveLength(1);
    expect(readLessonRef(result.slides)?.id).toBe("lesson-1");
  });

  it("přesune více slidů na začátek a konec", () => {
    const start = movePresentationSlidesToEdge(slides(), [1, 3], "start", 3)!;
    expect(start.slides.map((s) => s.slideId)).toEqual(["b", "d", "a", "c", "e"]);
    expect(start.activeIndex).toBe(1);
    const end = movePresentationSlidesToEdge(slides(), [0, 2], "end", 0)!;
    expect(end.slides.map((s) => s.slideId)).toEqual(["b", "d", "e", "a", "c"]);
    expect(readLessonRef(end.slides)?.id).toBe("lesson-1");
  });

  it("skryje slidy jen pro promítání a umí je znovu odkrýt", () => {
    const hidden = setPresentationSlidesHidden(slides(), [0, 2], true, 0)!;
    expect(visiblePresentationSlides(hidden.slides).map((s) => s.slideId)).toEqual(["b", "d", "e"]);
    expect(hidden.slides).toHaveLength(5);
    const shown = setPresentationSlidesHidden(hidden.slides, [0, 2], false, 0)!;
    expect(visiblePresentationSlides(shown.slides)).toHaveLength(5);
  });
});

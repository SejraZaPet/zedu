import { describe, it, expect } from "vitest";
import { buildItemsFromLessonActivity } from "@/lib/lesson-activity-to-worksheet";

const act = (activityType: string, props: any) => ({
  id: "a1",
  activityType,
  title: "Test",
  props,
});

describe("buildItemsFromLessonActivity", () => {
  it("mapuje přiřazování z tvaru left/right/pairs", () => {
    const [item] = buildItemsFromLessonActivity(
      act("matching", { matching: { left: ["A", "B"], right: ["1", "2"], pairs: [[0, 1], [1, 0]] } }),
    );
    expect(item.patch.matchPairs).toEqual([
      { left: "A", right: "2" },
      { left: "B", right: "1" },
    ]);
    expect(item.correct).toEqual(["A=2", "B=1"]);
  });

  it("vytvoří položku pro každou otázku kvízu", () => {
    const out = buildItemsFromLessonActivity(
      act("quiz", {
        quiz: {
          questions: [
            { question: "Q1", answers: [{ text: "a", correct: true }, { text: "b", correct: false }] },
            { question: "Q2", answers: [{ text: "c", correct: false }, { text: "d", correct: true }] },
          ],
        },
      }),
    );
    expect(out).toHaveLength(2);
    expect(out[1].patch.prompt).toBe("Q2");
    expect(out[1].correct).toBe("d");
  });

  it("mapuje třídění ze skupin", () => {
    const [item] = buildItemsFromLessonActivity(
      act("sorting", {
        sorting: { groups: ["Ovoce", "Zelenina"], items: [{ text: "Jablko", group: 0 }, { text: "Mrkev", group: 1 }] },
      }),
    );
    expect(item.patch.sortingCategories).toEqual([
      { id: "c0", label: "Ovoce" },
      { id: "c1", label: "Zelenina" },
    ]);
    expect(item.patch.sortingItems).toEqual([
      { text: "Jablko", categoryId: "c0" },
      { text: "Mrkev", categoryId: "c1" },
    ]);
  });

  it("mapuje doplňovačku z tokenů", () => {
    const [item] = buildItemsFromLessonActivity(
      act("fill_blanks", {
        fillBlanks: {
          tokens: [
            { type: "text", value: "Voda vře při " },
            { type: "blank", answer: "100" },
            { type: "text", value: " °C." },
          ],
        },
      }),
    );
    expect(item.patch.blankText).toBe("Voda vře při ___ °C.");
    expect(item.correct).toEqual(["100"]);
  });

  it("vytvoří položku pro každé tvrzení pravda/nepravda", () => {
    const out = buildItemsFromLessonActivity(
      act("true_false", { trueFalse: { statements: [{ text: "T1", isTrue: true }, { text: "T2", isTrue: false }] } }),
    );
    expect(out).toHaveLength(2);
    expect(out[1].correct).toBe("false");
  });

  it("přenese obrázek u popisu obrázku", () => {
    const [item] = buildItemsFromLessonActivity(
      act("image_label", {
        imageLabel: { imageUrl: "https://x/y.png", markers: [{ number: 1, x: 10, y: 20, answer: "srdce" }] },
      }),
    );
    expect(item.patch.imageUrl).toBe("https://x/y.png");
    expect(item.patch.imageLabels?.[0]).toMatchObject({ xPercent: 10, yPercent: 20, answer: "srdce" });
  });
});

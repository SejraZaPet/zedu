import { describe, expect, it } from "vitest";
import { cloneSlidesForInsertion, insertSlidesAtPosition } from "@/lib/presentation-slide-import";

const source = [
  { slideId: "a", projector: { headline: "A" }, teacherNotes: "Poznámka", backgroundOverride: { color: "#fff" }, blocks: [{ id: "b1", type: "image", props: { url: "https://img.test/a.png", children: [{ id: "nested", type: "paragraph", props: { text: "Text" } }] } }], activitySpec: { activityType: "mcq", question: "Otázka", correctOptionId: "answer-a", options: [{ id: "answer-a", text: "A", correct: true }] } },
  { slideId: "b", projector: { headline: "B" }, blocks: [] },
];

describe("kopírování slidů do prezentace", () => {
  it("zachová obsah, pozadí, aktivitu, obrázek i poznámky a obnoví všechna ID", () => {
    const [copy] = cloneSlidesForInsertion(source, new Set(["a"]));
    expect(copy.projector).toEqual(source[0].projector);
    expect(copy.teacherNotes).toBe("Poznámka");
    expect(copy.backgroundOverride).toEqual(source[0].backgroundOverride);
    expect(copy.activitySpec).toEqual(source[0].activitySpec);
    expect(copy.activitySpec.options[0].id).toBe("answer-a");
    expect(copy.activitySpec.correctOptionId).toBe(copy.activitySpec.options[0].id);
    expect(copy.blocks[0].props.url).toBe("https://img.test/a.png");
    expect(copy.slideId).not.toBe("a");
    expect(copy.blocks[0].id).not.toBe("b1");
    expect(copy.blocks[0].props.children[0].id).not.toBe("nested");
    expect(source[0].slideId).toBe("a");
  });

  it("vloží více slidů za aktuální v původním pořadí", () => {
    const copies = cloneSlidesForInsertion(source);
    const result = insertSlidesAtPosition([{ slideId: "one" }, { slideId: "two" }], copies, 0, "after");
    expect(result.slides.map((slide) => slide.projector?.headline ?? slide.slideId)).toEqual(["one", "A", "B", "two"]);
    expect(result.activeIndex).toBe(1);
  });

  it("umí vložit před aktuální slide a na konec", () => {
    expect(insertSlidesAtPosition([{ slideId: "one" }], cloneSlidesForInsertion(source), 0, "before").activeIndex).toBe(0);
    expect(insertSlidesAtPosition([{ slideId: "one" }], cloneSlidesForInsertion(source), 0, "end").slides).toHaveLength(3);
  });
});

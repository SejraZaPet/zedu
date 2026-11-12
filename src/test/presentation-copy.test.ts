import { describe, expect, it } from "vitest";
import { independentPresentationPayload } from "@/lib/presentation-copy";

describe("Uložit jako moji prezentaci", () => {
  it("zkopíruje sloučené snímky a zcela odstraní vazbu na lekci", () => {
    const fresh = [
      { slideId: "slide-1", sourceBlockId: "a", projector: { headline: "Nový nadpis", body: "Nový text" }, blocks: [] },
      { slideId: "slide-2", sourceBlockId: "b", projector: { headline: "Druhý", body: "Aktuální lekce" }, blocks: [] },
    ];
    const saved = [
      { slideId: "saved-1", sourceBlockId: "a", lockedFromLesson: true, projector: { headline: "Můj nadpis", body: "Můj text" }, blocks: [] },
      { slideId: "saved-2", sourceBlockId: "b", projector: { headline: "Starý", body: "Starý text", fontScale: 1.2 }, blocks: [] },
    ];

    const payload = independentPresentationPayload("teacher-1", "Fotosyntéza", fresh, saved);

    expect(payload).toMatchObject({
      teacher_id: "teacher-1",
      title: "Fotosyntéza – moje kopie",
      lesson_id: null,
      source_lesson_id: null,
      source_lesson_type: null,
    });
    expect(payload.slides).toHaveLength(2);
    expect(payload.slides[0].projector.body).toBe("Můj text");
    expect(payload.slides[1].projector.body).toBe("Aktuální lekce");
    expect(payload.slides[1].projector.fontScale).toBe(1.2);
  });

  it("kopie je hluboká a následné úpravy nemění sloučený zdroj", () => {
    const fresh = [{ slideId: "slide-1", projector: { headline: "A" }, blocks: [{ id: "b", props: { text: "Text" } }] }];
    const payload = independentPresentationPayload("teacher-1", "A", fresh, []);
    payload.slides[0].blocks[0].props.text = "Změněno";
    expect(fresh[0].blocks[0].props.text).toBe("Text");
  });
});

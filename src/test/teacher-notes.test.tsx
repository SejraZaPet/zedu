import { describe, it, expect } from "vitest";

/**
 * Poznámky pro učitele žijí přímo na objektu slidu v pendingSlides (JSONB).
 * updateSlide() dělá plošné rozšíření (spread) předchozího slidu, takže jiné
 * úpravy nesmí poznámku přepsat na undefined.
 */
const updateSlide = (slides: any[], index: number, patch: any) => {
  const updated = [...slides];
  updated[index] = { ...updated[index], ...patch };
  return updated;
};

describe("teacherNotes na blokovém slidu", () => {
  const base = [
    { slideId: "s1", type: "explain", projector: { headline: "A" }, blocks: [] },
    { slideId: "s2", type: "explain", projector: { headline: "B" }, blocks: [] },
  ];

  it("uloží poznámku na správný slide", () => {
    const next = updateSlide(base, 0, { teacherNotes: "Zmínit pokus s vodou" });
    expect(next[0].teacherNotes).toBe("Zmínit pokus s vodou");
    expect((next[1] as any).teacherNotes).toBeUndefined();
  });

  it("zachová poznámku při jiných úpravách slidu", () => {
    let slides = updateSlide(base, 0, { teacherNotes: "Poznámka" });
    slides = updateSlide(slides, 0, { layout: "split" });
    slides = updateSlide(slides, 0, { backgroundOverride: { color: "#111111" } });
    slides = updateSlide(slides, 0, { projector: { headline: "Nový titulek" } });
    expect(slides[0].teacherNotes).toBe("Poznámka");
    expect(slides[0].layout).toBe("split");
  });

  it("umožní poznámku vymazat prázdným textem", () => {
    let slides = updateSlide(base, 1, { teacherNotes: "X" });
    slides = updateSlide(slides, 1, { teacherNotes: "" });
    expect(slides[1].teacherNotes).toBe("");
  });
});

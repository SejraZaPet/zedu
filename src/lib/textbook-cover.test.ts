import { describe, expect, it } from "vitest";
import { autoCover, COVER_GRADIENTS, coverIconFor } from "./textbook-cover";

describe("textbook auto cover", () => {
  it("is stable for the same subject", () => {
    const a = autoCover({ subjectId: "s1", title: "A" });
    const b = autoCover({ subjectId: "s1", title: "B" });
    expect(a.gradient).toBe(b.gradient);
  });
  it("always picks a palette gradient", () => {
    for (const t of ["", "x", "Matematika 6", "Gastronomie"]) {
      expect(COVER_GRADIENTS).toContain(autoCover({ title: t }).gradient);
    }
  });
  it("maps subjects to icons with book fallback", () => {
    expect(coverIconFor("matematika")).toBe("calculator");
    expect(coverIconFor("", "Hovězí maso")).toBe("chef");
    expect(coverIconFor("xyz")).toBe("book");
  });
});

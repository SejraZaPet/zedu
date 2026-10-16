import { describe, it, expect } from "vitest";
import { limitActivityItems } from "../../supabase/functions/_shared/activity-item-limit";

describe("limitActivityItems", () => {
  it("ořízne 6 tvrzení na zvolené 4", () => {
    const p = { trueFalse: { statements: [1, 2, 3, 4, 5, 6] } };
    expect(limitActivityItems(p, 4).trueFalse.statements).toEqual([1, 2, 3, 4]);
  });
  it("ořízne dvojice na obou stranách stejně", () => {
    const r = limitActivityItems({ matching: { left: ["a", "b", "c"], right: ["1", "2", "3"] } }, 2);
    expect(r.matching).toEqual({ left: ["a", "b"], right: ["1", "2"] });
  });
  it("méně položek ani bez nastavení nic nemění", () => {
    const p = { ordering: { items: ["x", "y"] } };
    expect(limitActivityItems(p, 4)).toEqual(p);
    expect(limitActivityItems(p, null)).toBe(p);
  });
});

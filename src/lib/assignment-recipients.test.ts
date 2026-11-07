import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { audienceAllowed, audienceError, effectiveRecipients, isFormerRecipient, recipientDiff } from "./assignment-recipients";

describe("assignment-recipients", () => {
  it("bez výběru = celá třída bez testovacích žáků", () => {
    expect(effectiveRecipients(["a", "b", "p"], [], ["p"])).toEqual(["a", "b"]);
  });
  it("s výběrem = průnik se členy (odebraný ze třídy vypadne)", () => {
    expect(effectiveRecipients(["a", "b", "c"], ["b", "x"])).toEqual(["b"]);
  });
  it("testovací žák se nezapočítá ani když je vybraný", () => {
    expect(effectiveRecipients(["a", "p"], ["a", "p"], ["p"])).toEqual(["a"]);
  });
  it("rozdíl výběru", () => {
    expect(recipientDiff(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
  });
  it("zveřejnit s 0 vybranými nejde", () => {
    expect(audienceError("selected", 0, 1)).toBe("Vyberte alespoň jednoho žáka.");
    expect(audienceError("selected", 2, 2)).toMatch(/jedné třídy/);
    expect(audienceError("selected", 2, 1)).toBeNull();
    expect(audienceError("all", 0, 3)).toBeNull();
  });
  it("výběr jen u úkolu a materiálu", () => {
    expect(audienceAllowed("task")).toBe(true);
    expect(audienceAllowed("material")).toBe(true);
    expect(audienceAllowed("announcement")).toBe(false);
  });
  it("odebraný žák s odevzdáním je označen", () => {
    expect(isFormerRecipient("a", ["b"])).toBe(true);
    expect(isFormerRecipient("a", [])).toBe(false);
  });
});

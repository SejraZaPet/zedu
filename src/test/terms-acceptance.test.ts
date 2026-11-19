import { describe, it, expect } from "vitest";
import { pendingTermsAcceptance } from "@/lib/terms-acceptance";

describe("doklad o souhlasu z registrace", () => {
  it("bez verze v registraci se nic nezapisuje", () => expect(pendingTermsAcceptance({ first_name: "x" })).toBeNull());
  it("převezme verzi 1.0 a čas souhlasu", () => {
    expect(pendingTermsAcceptance({ terms_version: "1.0", terms_accepted_at: "2026-11-19T10:00:00.000Z" }))
      .toEqual({ version: "1.0", acceptedAt: "2026-11-19T10:00:00.000Z" });
  });
  it("čas v budoucnosti nahradí aktuálním", () => {
    const p = pendingTermsAcceptance({ terms_version: "1.0", terms_accepted_at: "2099-01-01T00:00:00Z" })!;
    expect(Date.parse(p.acceptedAt)).toBeLessThanOrEqual(Date.now());
  });
});

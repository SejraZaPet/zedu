import { describe, it, expect } from "vitest";
import { TERMS_VERSION, registrationConsentError, requiresTermsConsent } from "@/lib/terms";

describe("souhlas s obchodními podmínkami při registraci", () => {
  it("výchozí verze 1.0", () => expect(TERMS_VERSION).toBe("1.0"));
  it("učitel a lektor bez zaškrtnutí nejde odeslat", () => {
    expect(registrationConsentError("teacher", false)).toMatch(/obchodními podmínkami/);
    expect(registrationConsentError("lektor", false)).toMatch(/obchodními podmínkami/);
  });
  it("se zaškrtnutím lze odeslat", () => expect(registrationConsentError("teacher", true)).toBeNull());
  it("žák a rodič podmínky nepotvrzují", () => {
    expect(requiresTermsConsent("student")).toBe(false);
    expect(requiresTermsConsent("rodic")).toBe(false);
    expect(registrationConsentError("student", false)).not.toMatch(/obchodními/);
  });
});

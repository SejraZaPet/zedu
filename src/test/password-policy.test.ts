import { describe, expect, it } from "vitest";
import {
  getAuthPasswordErrorMessage,
  getPasswordPolicyError,
  MIN_PASSWORD_LENGTH,
  SAME_PASSWORD_MESSAGE,
  WEAK_PASSWORD_MESSAGE,
} from "@/lib/password-policy";
import { resolvePasswordResetFailure } from "@/lib/password-reset-client";

 describe("password policy", () => {
  it("vyžaduje alespoň 8 znaků", () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(getPasswordPolicyError("Kratky7")).toBe("Heslo musí mít alespoň 8 znaků.");
    expect(getPasswordPolicyError("Tri-Slova-Za-Sebou")).toBeNull();
  });

  it("odmítne běžné heslo bez ohledu na velikost písmen ještě před odesláním", () => {
    expect(getPasswordPolicyError("HeSlO123")).toBe(WEAK_PASSWORD_MESSAGE);
    expect(getPasswordPolicyError("12345678")).toBe(WEAK_PASSWORD_MESSAGE);
  });

  it("přeloží odmítnutí uniklého hesla a shodného starého hesla", () => {
    expect(getAuthPasswordErrorMessage({
      code: "weak_password",
      message: "Password is known to be weak and easy to guess",
    })).toBe(WEAK_PASSWORD_MESSAGE);
    expect(getAuthPasswordErrorMessage({
      code: "same_password",
      message: "New password should be different from the old password",
    })).toBe(SAME_PASSWORD_MESSAGE);
  });

  it("převezme skutečnou minimální délku z odpovědi systému účtů", () => {
    expect(getAuthPasswordErrorMessage({ message: "Password should be at least 10 characters" }))
      .toBe("Heslo musí mít alespoň 10 znaků.");
  });
});

describe("password reset function errors", () => {
  it("čte weak_password z FunctionsHttpError.context.json", async () => {
    const failure = await resolvePasswordResetFailure(null, {
      message: "Edge Function returned a non-2xx status code",
      context: { json: async () => ({ code: "weak_password", error: WEAK_PASSWORD_MESSAGE }) },
    });
    expect(failure).toEqual({ code: "weak_password", message: WEAK_PASSWORD_MESSAGE });
  });

  it("nečitelná síťová chyba není neplatný odkaz", async () => {
    const failure = await resolvePasswordResetFailure(null, { message: "Failed to fetch" });
    expect(failure.code).toBe("reset_failed");
    expect(failure.message).toBe("Heslo se nepodařilo změnit. Zkuste to prosím znovu.");
  });
});

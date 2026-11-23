export const WEAK_PASSWORD_MESSAGE =
  "Toto heslo je příliš běžné nebo uniklo na internet. Zvolte delší a méně obvyklé heslo, např. tři slova za sebou.";
export const SAME_PASSWORD_MESSAGE = "Nové heslo musí být jiné než dosavadní heslo.";

export type PasswordErrorBody = { code: string; error: string };
type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/** Bezpečná česká chyba bez vracení technické odpovědi systému účtů klientovi. */
export function getAuthPasswordError(error: AuthErrorLike): PasswordErrorBody | null {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "");
  const searchable = `${code} ${message}`.toLowerCase();

  if (
    code === "weak_password" ||
    /weak password|password is known|pwned|compromised|common password|easy to guess/.test(searchable)
  ) {
    return { code: "weak_password", error: WEAK_PASSWORD_MESSAGE };
  }
  if (code === "same_password" || /same password|different from the old password/.test(searchable)) {
    return { code: "same_password", error: SAME_PASSWORD_MESSAGE };
  }
  const lengthMatch = message.match(/at least\s+(\d+)\s+characters/i);
  if (lengthMatch) {
    return { code: "password_too_short", error: `Heslo musí mít alespoň ${lengthMatch[1]} znaků.` };
  }
  if (code === "password_too_short" || /password.*(?:too short|length)|password should be at least/i.test(searchable)) {
    return { code: "password_too_short", error: "Heslo musí mít alespoň 8 znaků." };
  }
  return null;
}

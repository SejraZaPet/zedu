export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_POLICY_HINT =
  "Alespoň 8 znaků, vyhněte se běžným heslům (123456, heslo, jméno školy)";

export const WEAK_PASSWORD_MESSAGE =
  "Toto heslo je příliš běžné nebo uniklo na internet. Zvolte delší a méně obvyklé heslo, např. tři slova za sebou.";

export const SAME_PASSWORD_MESSAGE = "Nové heslo musí být jiné než dosavadní heslo.";

// Malá, záměrně konzervativní blokace nejčastějších voleb. Autoritativní kontrola
// (včetně databáze uniklých hesel) proběhne vždy také v systému účtů.
const COMMON_PASSWORDS = new Set([
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "12345",
  "123123",
  "111111",
  "000000",
  "654321",
  "666666",
  "987654321",
  "qwerty",
  "qwerty123",
  "qwertz",
  "azerty",
  "abc123",
  "password",
  "password1",
  "heslo",
  "heslo1",
  "heslo123",
  "admin",
  "admin123",
  "letmein",
  "welcome",
  "welcome1",
  "iloveyou",
  "monkey",
  "dragon",
  "football",
  "baseball",
  "1q2w3e4r",
  "zaq12wsx",
  "skola",
  "skola123",
  "bezli",
  "bezli123",
]);

export function getPasswordPolicyError(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků.`;
  }
  if (COMMON_PASSWORDS.has(password.trim().toLowerCase())) {
    return WEAK_PASSWORD_MESSAGE;
  }
  return null;
}

type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined;

/** Přeloží pouze chyby týkající se hesla; ostatní chyby nechává původnímu zpracování. */
export function getAuthPasswordErrorMessage(error: AuthErrorLike): string | null {
  const code = String(error?.code ?? "").toLowerCase();
  const message = String(error?.message ?? "");
  const searchable = `${code} ${message}`.toLowerCase();

  if (
    code === "weak_password" ||
    /weak password|password is known|pwned|compromised|common password|easy to guess/.test(searchable)
  ) {
    return WEAK_PASSWORD_MESSAGE;
  }
  if (code === "same_password" || /same password|different from the old password/.test(searchable)) {
    return SAME_PASSWORD_MESSAGE;
  }

  const lengthMatch = message.match(/at least\s+(\d+)\s+characters/i);
  if (lengthMatch) return `Heslo musí mít alespoň ${lengthMatch[1]} znaků.`;
  if (code === "password_too_short" || /password.*(?:too short|length)|password should be at least/i.test(searchable)) {
    return `Heslo musí mít alespoň ${MIN_PASSWORD_LENGTH} znaků.`;
  }
  return null;
}

import { getAuthPasswordError } from "../_shared/password-errors.ts";

type JsonResponse = (status: number, body: unknown) => Response;
type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined;

export function isValidPasswordResetToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/i.test(token.trim());
}

/**
 * Dokončení obnovy je oddělené pro test pořadí: odmítnuté heslo nikdy
 * neoznačí token jako použitý. Heslo ani token se zde nezapisují do logů.
 */
export async function completePasswordReset(
  operations: {
    updatePassword: () => Promise<AuthErrorLike>;
    markTokensUsed: () => Promise<unknown>;
    syncLoginPassword: () => Promise<unknown>;
  },
  json: JsonResponse,
): Promise<Response> {
  const updateError = await operations.updatePassword();
  if (updateError) {
    const passwordError = getAuthPasswordError(updateError);
    if (passwordError) return json(422, passwordError);
    return json(500, {
      code: "reset_failed",
      error: "Nepodařilo se nastavit nové heslo. Zkuste to prosím znovu.",
    });
  }

  // Token se smí spotřebovat až po úspěšné změně hesla v systému účtů.
  await operations.markTokensUsed();
  await operations.syncLoginPassword();
  return json(200, { message: "Heslo bylo změněno." });
}

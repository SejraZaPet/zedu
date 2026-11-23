import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { completePasswordReset, isValidPasswordResetToken } from "./core.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

Deno.test("weak_password nechá token nepoužitý a vrátí 422", async () => {
  const calls: string[] = [];
  const response = await completePasswordReset({
    updatePassword: async () => {
      calls.push("update");
      return { code: "weak_password", message: "Password is known to be weak and easy to guess" };
    },
    markTokensUsed: async () => { calls.push("consume"); },
    syncLoginPassword: async () => { calls.push("sync"); },
  }, json);

  assertEquals(response.status, 422);
  assertEquals((await response.json()).code, "weak_password");
  assertEquals(calls, ["update"]);
});

Deno.test("HIBP odpověď bez kódu se pozná a token se nespotřebuje", async () => {
  let consumed = false;
  const response = await completePasswordReset({
    updatePassword: async () => ({ message: "Password is known to be weak and easy to guess" }),
    markTokensUsed: async () => { consumed = true; },
    syncLoginPassword: async () => {},
  }, json);

  assertEquals(response.status, 422);
  assertEquals((await response.json()).code, "weak_password");
  assertEquals(consumed, false);
});

Deno.test("token se spotřebuje až po úspěšné změně hesla", async () => {
  const calls: string[] = [];
  const response = await completePasswordReset({
    updatePassword: async () => { calls.push("update"); return null; },
    markTokensUsed: async () => { calls.push("consume"); },
    syncLoginPassword: async () => { calls.push("sync"); },
  }, json);

  assertEquals(response.status, 200);
  assertEquals(calls, ["update", "consume", "sync"]);
  await response.text();
});

Deno.test("neplatný tvar tokenu se pozná před dotazem do databáze", () => {
  assertEquals(isValidPasswordResetToken("a".repeat(64)), true);
  assertEquals(isValidPasswordResetToken("a".repeat(63)), false);
  assertEquals(isValidPasswordResetToken("not-a-token"), false);
  assertEquals(isValidPasswordResetToken(null), false);
});

// Limit AI generování pro demo účty. Běžní uživatelé: vždy povoleno, nic se nezapisuje.
// Rezervace probíhá atomicky v DB (demo_ai_reserve, advisory lock), takže souběžná
// volání limit neobejdou. Hodnoty limitů jsou v tabulce demo_config.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

export const DEMO_AI_LIMIT_MESSAGE =
  "Testovací účet má limit AI generování. Pro plný přístup se zaregistrujte.";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

/** Vrátí Response 429 při vyčerpání limitu demo účtu, jinak null. */
export async function demoAiGuard(
  auth: { ok: boolean; userId?: string; isServiceRole?: boolean },
  fnName: string,
): Promise<Response | null> {
  if (!auth?.ok || auth.isServiceRole || !auth.userId) return null;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await db.rpc("demo_ai_reserve", { _user_id: auth.userId, _fn: fnName });
  if (error) {
    console.error("demo_ai_reserve failed", error.message);
    return null; // nesmí rozbít běžné uživatele
  }
  if (data === false) {
    return new Response(JSON.stringify({ error: DEMO_AI_LIMIT_MESSAGE }), { status: 429, headers });
  }
  return null;
}

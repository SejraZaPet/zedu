import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;

async function countRecentFailures(admin: any, identifier: string): Promise<number> {
  try {
    const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
    const { count } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .eq("success", false)
      .gte("created_at", since);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function recordAttempt(admin: any, identifier: string, success: boolean) {
  try {
    await admin.from("login_attempts").insert({ identifier, success, kind: "verify-pin" });
  } catch { /* table may not exist yet */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const { username, pin } = await req.json();
    if (!username || !pin || !/^\d{4}$/.test(String(pin))) {
      return new Response(JSON.stringify({ error: "Neplatné údaje" }), {
        status: 400,
        headers: jsonHeaders,
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const identifier = `pin:${String(username).toLowerCase().trim()}`;

    const failures = await countRecentFailures(admin, identifier);
    if (failures >= MAX_ATTEMPTS) {
      return new Response(
        JSON.stringify({ error: "Příliš mnoho pokusů, zkuste to za chvíli." }),
        { status: 429, headers: jsonHeaders }
      );
    }

    const { data, error: rpcError } = await admin.rpc("verify_pin_login", {
      _username: String(username).trim(),
      _pin: String(pin),
    });

    const result = data as { error?: string; email?: string } | null;
    if (rpcError || result?.error || !result?.email) {
      await recordAttempt(admin, identifier, false);
      return new Response(JSON.stringify({ error: result?.error || "Špatný PIN nebo uživatelské jméno." }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: result.email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      await recordAttempt(admin, identifier, false);
      return new Response(JSON.stringify({ error: linkError?.message || "Nepodařilo se vytvořit přihlašovací relaci." }), {
        status: 500,
        headers: jsonHeaders,
      });
    }

    await recordAttempt(admin, identifier, true);

    return new Response(JSON.stringify({
      email: result.email,
      token_hash: tokenHash,
    }), { headers: jsonHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: jsonHeaders,
    });
  }
});

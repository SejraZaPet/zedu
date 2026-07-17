import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  try {
    const { token, new_password } = await req.json().catch(() => ({}));
    if (
      !token ||
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token.trim())
    ) {
      return json(400, { error: "Odkaz je neplatný nebo vypršel." });
    }
    if (!new_password || typeof new_password !== "string" || new_password.length < 6) {
      return json(400, { error: "Heslo musí mít alespoň 6 znaků." });
    }
    if (new_password.length > 200) {
      return json(400, { error: "Heslo je příliš dlouhé." });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const tokenHash = await sha256Hex(token.trim());
    const { data: row } = await admin
      .from("password_reset_tokens")
      .select("id, user_id, expires_at, used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
      return json(400, { error: "Odkaz je neplatný nebo vypršel." });
    }

    const { error: updErr } = await admin.auth.admin.updateUserById(row.user_id, {
      password: new_password,
    });
    if (updErr) {
      console.error("updateUserById error", updErr.message);
      return json(500, { error: "Nepodařilo se nastavit nové heslo. Zkuste to prosím znovu." });
    }

    const nowIso = new Date().toISOString();
    // Mark this token used + invalidate all other unused tokens for user
    await admin
      .from("password_reset_tokens")
      .update({ used_at: nowIso })
      .eq("user_id", row.user_id)
      .is("used_at", null);

    // Write-through mailbox: trg_sync_login_password trigger encrypts this into profile_credentials and nulls this column before commit
    await admin
      .from("profiles")
      .update({ login_password: new_password })
      .eq("id", row.user_id);

    return json(200, { message: "Heslo bylo změněno." });
  } catch (e) {
    console.error("confirm-password-reset error", (e as Error).message);
    return json(500, { error: "Došlo k chybě. Zkuste to prosím znovu." });
  }
});

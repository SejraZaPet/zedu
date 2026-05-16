import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { username, pin } = await req.json();
    if (!username || !pin || !/^\d{4}$/.test(String(pin))) {
      return new Response(JSON.stringify({ error: "Neplatné údaje" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error: rpcError } = await admin.rpc("verify_pin_login", {
      _username: String(username).trim(),
      _pin: String(pin),
    });

    const result = data as { error?: string; email?: string } | null;
    if (rpcError || result?.error || !result?.email) {
      return new Response(JSON.stringify({ error: result?.error || "Špatný PIN nebo uživatelské jméno." }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: result.email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (linkError || !tokenHash) {
      return new Response(JSON.stringify({ error: linkError?.message || "Nepodařilo se vytvořit přihlašovací relaci." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      email: result.email,
      token_hash: tokenHash,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

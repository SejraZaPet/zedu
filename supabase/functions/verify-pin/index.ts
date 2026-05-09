import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

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

    const { data: profile, error: pErr } = await admin
      .from("profiles")
      .select("id, email, pin_code, login_password")
      .eq("username", String(username).toLowerCase().trim())
      .maybeSingle();

    if (pErr || !profile || !profile.pin_code) {
      return new Response(JSON.stringify({ error: "Uživatel nebo PIN nenalezen" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ok = await bcrypt.compare(String(pin), profile.pin_code);
    if (!ok) {
      return new Response(JSON.stringify({ error: "Nesprávný PIN" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.login_password) {
      return new Response(JSON.stringify({ error: "Účet nemá uložené heslo, kontaktujte učitele" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Vytvoř session pomocí uloženého hesla
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { data: session, error: sErr } = await anon.auth.signInWithPassword({
      email: profile.email,
      password: profile.login_password,
    });

    if (sErr || !session.session) {
      return new Response(JSON.stringify({ error: "Nepodařilo se přihlásit" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      access_token: session.session.access_token,
      refresh_token: session.session.refresh_token,
      user_id: profile.id,
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

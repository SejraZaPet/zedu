import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// To prevent unauthenticated user-email enumeration, this endpoint now
// requires the caller to supply the password too. We resolve the email
// from the username and verify the password server-side via
// signInWithPassword. The email is only returned when the credentials
// are valid (i.e. the caller already knows them).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  try {
    const { username, password } = await req.json().catch(() => ({}));
    if (
      !username || typeof username !== "string" ||
      !password || typeof password !== "string"
    ) {
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();

    if (error || !profile?.email) {
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }

    // Verify the password before disclosing the email.
    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }

    return new Response(JSON.stringify({ email: profile.email }), { status: 200, headers: jsonHeaders });
  } catch {
    return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const MIN_RESPONSE_MS = 450; // timing floor to normalize hit/miss branches

const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));

// Dummy bcrypt-comparable cost: pad time to a constant floor so username-miss
// and password-miss branches have similar response time.
async function padTiming(startedAt: number) {
  const elapsed = Date.now() - startedAt;
  if (elapsed < MIN_RESPONSE_MS) await sleep(MIN_RESPONSE_MS - elapsed);
}

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
    return 0; // table not yet created — fail open
  }
}

async function recordAttempt(admin: any, identifier: string, success: boolean, kind: string) {
  try {
    await admin.from("login_attempts").insert({ identifier, success, kind });
  } catch {
    /* table may not exist yet */
  }
}

// To prevent unauthenticated user-email enumeration, this endpoint requires
// the caller to supply the password. Server verifies password once via
// signInWithPassword and returns a one-time magic-link token_hash which the
// client uses to establish the session — avoiding a duplicate password call.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  const startedAt = Date.now();

  try {
    const { username, password } = await req.json().catch(() => ({}));
    if (
      !username || typeof username !== "string" ||
      !password || typeof password !== "string"
    ) {
      await padTiming(startedAt);
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }

    const identifier = `u:${username.toLowerCase().trim()}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Rate limit
    const failures = await countRecentFailures(admin, identifier);
    if (failures >= MAX_ATTEMPTS) {
      await padTiming(startedAt);
      return new Response(
        JSON.stringify({ error: "Příliš mnoho pokusů, zkuste to za chvíli." }),
        { status: 429, headers: jsonHeaders }
      );
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("email")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );

    if (!profile?.email) {
      // Timing side-channel defense: perform equivalent bcrypt-cost work
      // against a dummy account so miss and hit branches are indistinguishable.
      await anon.auth.signInWithPassword({
        email: "__dummy_timing__@zedu.invalid",
        password: password.slice(0, 72),
      }).catch(() => null);
      await recordAttempt(admin, identifier, false, "lookup-username");
      await padTiming(startedAt);
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }

    // Single server-side password verification
    const { error: signInError } = await anon.auth.signInWithPassword({
      email: profile.email,
      password,
    });

    if (signInError) {
      await recordAttempt(admin, identifier, false, "lookup-username");
      await padTiming(startedAt);
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }

    // Issue a one-time magic-link token — client uses verifyOtp instead of
    // calling signInWithPassword a second time.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
    });
    const tokenHash = (linkData as any)?.properties?.hashed_token ?? null;

    await recordAttempt(admin, identifier, true, "lookup-username");
    await padTiming(startedAt);

    if (linkError || !tokenHash) {
      // Fallback: return email; caller can retry signIn (legacy path)
      return new Response(JSON.stringify({ email: profile.email }), { status: 200, headers: jsonHeaders });
    }

    return new Response(
      JSON.stringify({ email: profile.email, token_hash: tokenHash }),
      { status: 200, headers: jsonHeaders }
    );
  } catch {
    await padTiming(startedAt);
    return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
  }
});

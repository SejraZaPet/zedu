import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOKEN_EXPIRY_SEC = 900; // 15 minutes — refreshed on each reconnect

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { gameCode, nickname } = await req.json();

    if (!gameCode || typeof gameCode !== "string" || gameCode.length > 10) {
      return new Response(JSON.stringify({ error: "Invalid game code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!nickname || typeof nickname !== "string" || nickname.trim().length === 0 || nickname.length > 30) {
      return new Response(JSON.stringify({ error: "Invalid nickname" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRole);

    // Check if caller is authenticated (optional)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (user) userId = user.id;
    }

    // Find active session by code
    const trimmedCode = gameCode.trim().toUpperCase();
    const { data: sessions, error: sessErr } = await adminClient
      .from("game_sessions")
      .select("id, status")
      .eq("game_code", trimmedCode)
      .neq("status", "finished")
      .limit(1);

    if (sessErr) throw sessErr;
    if (!sessions?.length) {
      return new Response(JSON.stringify({ error: "Game not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = sessions[0];

    // Prevent duplicate joins for authenticated users
    if (userId) {
      const { data: existing } = await adminClient
        .from("game_players")
        .select("id, join_token, token_expires_at")
        .eq("session_id", session.id)
        .eq("user_id", userId)
        .limit(1);

      if (existing?.length) {
        // Refresh token for reconnect
        const token = generateToken();
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SEC * 1000).toISOString();
        await adminClient
          .from("game_players")
          .update({ join_token: token, token_expires_at: expiresAt })
          .eq("id", existing[0].id);

        return new Response(
          JSON.stringify({
            sessionId: session.id,
            playerId: existing[0].id,
            joinToken: token,
            expiresAt,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create player with server-generated token
    const token = generateToken();
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SEC * 1000).toISOString();

    const { data: player, error: playerErr } = await adminClient
      .from("game_players")
      .insert({
        session_id: session.id,
        user_id: userId,
        nickname: nickname.trim().slice(0, 20),
        join_token: token,
        token_expires_at: expiresAt,
      })
      .select("id")
      .single();

    if (playerErr) throw playerErr;

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        playerId: player.id,
        joinToken: token,
        expiresAt,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("join-game error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

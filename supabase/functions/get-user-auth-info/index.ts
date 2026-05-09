import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller via JWT claims (doesn't require active session)
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized", details: claimsError?.message }), { status: 401, headers: corsHeaders });
    }
    const callerId = claimsData.claims.sub;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const body = await req.json().catch(() => ({}));
    const requestedUserId = typeof body?.user_id === "string" ? body.user_id : callerId;

    const { data: adminRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin");
    const isAdmin = Boolean(adminRoles?.length);

    if (requestedUserId !== callerId && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
    }

    if (body?.include_profile === true) {
      const [{ data: profile }, { data: userRoles }] = await Promise.all([
        adminClient.from("profiles").select("*").eq("id", requestedUserId).maybeSingle(),
        adminClient.from("user_roles").select("role").eq("user_id", requestedUserId),
      ]);

      return new Response(JSON.stringify({
        profile,
        roles: (userRoles ?? []).map((row) => row.role),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!requestedUserId) {
      return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: corsHeaders });
    }

    const { data: { user }, error } = await adminClient.auth.admin.getUserById(requestedUserId);
    if (error || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), { status: 404, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      last_sign_in_at: user.last_sign_in_at,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});

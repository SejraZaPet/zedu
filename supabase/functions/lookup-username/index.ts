import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };
  try {
    const { username } = await req.json();
    if (!username || typeof username !== "string") {
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("username", username.toLowerCase().trim())
      .maybeSingle();
    if (error || !data?.email) {
      return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
    }
    return new Response(JSON.stringify({ email: data.email }), { status: 200, headers: jsonHeaders });
  } catch {
    return new Response(JSON.stringify({ email: null }), { status: 200, headers: jsonHeaders });
  }
});

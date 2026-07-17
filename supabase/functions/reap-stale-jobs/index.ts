import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getInternalSecret } from "../_shared/internal-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CRON_SECRET = (await getInternalSecret("cron_internal_secret"))?.trim();
  const got = req.headers.get("X-Cron-Secret")?.trim();
  if (!CRON_SECRET || got !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Call the existing DB function that reaps stale jobs
    const { data, error } = await supabase.rpc("reap_stale_export_jobs");

    if (error) {
      console.error("reap_stale_export_jobs error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const requeued = data ?? 0;
    console.log(`[reaper] requeued ${requeued} stale jobs`);

    return new Response(
      JSON.stringify({ requeued, timestamp: new Date().toISOString() }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[reaper] unexpected error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Úklid záznamů chatu na webu a obsahu e-mailů (retention_config). Spouští pg_cron s X-Cron-Secret.
// Veškerá logika je v SQL funkci run_log_retention (jen service_role); tady jen ověření a volání.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/demo.ts";
import { getInternalSecret } from "../_shared/internal-secret.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const secret = (await getInternalSecret("cron_internal_secret"))?.trim();
  const got = req.headers.get("X-Cron-Secret")?.trim();
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "").trim();
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!((secret && got === secret) || (srk && bearer === srk))) return json({ error: "Unauthorized" }, 401);

  const { data, error } = await adminClient().rpc("run_log_retention");
  if (error) {
    console.error("log-retention-cleanup failed");
    return json({ error: "retention_failed" }, 500);
  }
  console.log("log-retention-cleanup", JSON.stringify(data));
  return json(data);
});

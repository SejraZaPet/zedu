// Noční úklid demo dvojic neaktivních ≥ demo_config.inactive_days. Spouští pg_cron s X-Cron-Secret.
// Maže výhradně účty z demo_pairs (kontroluje demo_purge_pair); seed, sdílení spolužáci a Demo škola zůstávají.
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

  const db = adminClient();
  const { data: pairs, error } = await db.rpc("demo_cleanup_candidates");
  if (error) return json({ error: error.message }, 500);

  const { data: shared } = await db.from("demo_shared_users").select("user_id");
  const sharedIds = new Set((shared ?? []).map((r: { user_id: string }) => r.user_id));

  const details: Record<string, unknown>[] = [];
  let deleted = 0;
  for (const p of (pairs ?? []) as { pair_id: string; teacher_user_id: string; student_user_id: string }[]) {
    try {
      if (sharedIds.has(p.teacher_user_id) || sharedIds.has(p.student_user_id)) throw new Error("shared_user");
      // soubory ve storage
      const { data: objs } = await db.rpc("demo_pair_storage_objects", { _pair_id: p.pair_id });
      const byBucket = new Map<string, string[]>();
      for (const o of (objs ?? []) as { bucket_id: string; name: string }[]) {
        byBucket.set(o.bucket_id, [...(byBucket.get(o.bucket_id) ?? []), o.name]);
      }
      let files = 0;
      for (const [bucket, names] of byBucket) {
        const { error: sErr } = await db.storage.from(bucket).remove(names);
        if (!sErr) files += names.length;
      }
      const { data: rows, error: pErr } = await db.rpc("demo_purge_pair", { _pair_id: p.pair_id });
      if (pErr) throw new Error(pErr.message);
      for (const id of [p.teacher_user_id, p.student_user_id]) {
        const { error: dErr } = await db.auth.admin.deleteUser(id);
        if (dErr) throw new Error("delete_user_failed");
      }
      deleted++;
      details.push({ pair: p.pair_id, files, rows });
    } catch (e) {
      details.push({ pair: p.pair_id, error: (e as Error).message });
    }
  }
  await db.from("demo_cleanup_log").insert({ pairs_deleted: deleted, details: { pairs: details } });
  console.log("demo-cleanup", deleted, JSON.stringify(details));
  return json({ pairs_deleted: deleted, details });
});

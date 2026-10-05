// Dočasné: smaže testovací demo dvojice s event_tag TEST1C. Po použití se funkce maže.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { adminClient } from "../_shared/demo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = adminClient();
  const { data: pairs } = await db.from("demo_pairs").select("*").eq("event_tag", "TEST1C");
  const done: string[] = [];
  for (const p of pairs ?? []) {
    const { data: as } = await db.from("assignments").select("id").eq("teacher_id", p.teacher_user_id);
    const ids = (as ?? []).map((a: { id: string }) => a.id);
    if (ids.length) {
      await db.from("assignment_attempts").delete().in("assignment_id", ids);
      await db.from("assignments").delete().in("id", ids);
    }
    await db.from("class_members").delete().eq("class_id", p.group_id);
    await db.from("classes").delete().eq("id", p.group_id);
    await db.from("demo_pairs").delete().eq("id", p.id);
    for (const u of [p.teacher_user_id, p.student_user_id]) {
      const { error } = await db.auth.admin.deleteUser(u);
      done.push(u + (error ? " ERR " + error.message : " ok"));
    }
  }
  await db.from("demo_rate_events").delete().gte("created_at", new Date(Date.now() - 3 * 3600_000).toISOString());
  return new Response(JSON.stringify({ done }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

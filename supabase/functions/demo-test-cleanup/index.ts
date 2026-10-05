// DOČASNÉ: smaže demo dvojici volajícího (oba účty + demo třídu). Po testu se funkce maže.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { adminClient } from "../_shared/demo.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuth(req);
  if (!auth.ok) return new Response("unauthorized", { status: 401, headers: corsHeaders });
  const db = adminClient();
  const { data: pair } = await db.from("demo_pairs").select("*")
    .or(`teacher_user_id.eq.${auth.userId},student_user_id.eq.${auth.userId}`).maybeSingle();
  if (!pair) return new Response("forbidden", { status: 403, headers: corsHeaders });
  const ids = [pair.teacher_user_id, pair.student_user_id];
  await db.from("assignments").delete().in("teacher_id", ids);
  if (pair.group_id) await db.from("classes").delete().eq("id", pair.group_id);
  await db.from("notifications").delete().in("recipient_id", ids);
  await db.from("demo_pairs").delete().eq("id", pair.id);
  for (const id of ids) {
    for (const t of ["user_roles", "student_xp", "student_portfolio_items"]) await db.from(t).delete().eq("user_id", id).then(() => {}, () => {});
    await db.from("profiles").delete().eq("id", id);
    const { error } = await db.auth.admin.deleteUser(id);
    if (error) console.error("deleteUser", id, error.message);
  }
  return new Response(JSON.stringify({ ok: true, ids }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

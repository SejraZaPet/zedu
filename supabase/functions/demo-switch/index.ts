// Přepnutí demo učitel ↔ demo žák: vrátí relaci druhého účtu z dvojice volajícího.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { adminClient, issueSession } from "../_shared/demo.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  const db = adminClient();
  const { data: pair } = await db.from("demo_pairs")
    .select("id, teacher_user_id, student_user_id")
    .or(`teacher_user_id.eq.${auth.userId},student_user_id.eq.${auth.userId}`)
    .maybeSingle();
  if (!pair) return json({ error: "Přepínání je dostupné jen v testovacím režimu." }, 403);

  const targetId = pair.teacher_user_id === auth.userId ? pair.student_user_id : pair.teacher_user_id;
  const role = pair.teacher_user_id === auth.userId ? "student" : "teacher";
  const { data: u } = await db.auth.admin.getUserById(targetId);
  if (!u?.user?.email) return json({ error: "Druhý účet nebyl nalezen." }, 404);

  try {
    const session = await issueSession(db, u.user.email);
    await db.from("demo_pairs").update({ last_active_at: new Date().toISOString() }).eq("id", pair.id);
    return json({ session, role });
  } catch {
    return json({ error: "Přepnutí se nepodařilo. Zkuste to prosím znovu." }, 500);
  }
});

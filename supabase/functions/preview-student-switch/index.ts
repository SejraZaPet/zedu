// Přepnutí systémového admina na jeho vlastního testovacího žáka (preview_students).
// Cílové ID se nikdy nebere z klienta – vždy jen vlastní testovací žák volajícího.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireAuth } from "../_shared/auth.ts";
import { adminClient, issueSession } from "../_shared/demo.ts";
import { syncPreviewMemberships } from "../_shared/preview-sync.ts";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  const db = adminClient();

  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", auth.userId);
  const isAdmin = (roles ?? []).some((r: { role: string }) => r.role === "admin");
  const { data: isDemo } = await db.rpc("is_demo_user", { _user_id: auth.userId });
  if (!isAdmin || isDemo) return json({ error: "Přepnutí na testovacího žáka není dostupné." }, 403);

  let { data: ps } = await db.from("preview_students").select("student_id").eq("owner_id", auth.userId).maybeSingle();
  if (!ps) {
    const email = `preview-${crypto.randomUUID()}@preview.invalid`; // nikdy se neodesílá
    const { data: u, error } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { first_name: "Testovací", last_name: "žák", role_label: "student", status: "approved" },
    });
    if (error || !u?.user) return json({ error: "Testovacího žáka se nepodařilo vytvořit." }, 500);
    await db.from("profiles").update({ status: "approved", school_id: null }).eq("id", u.user.id);
    const { error: insErr } = await db.from("preview_students").insert({ student_id: u.user.id, owner_id: auth.userId });
    if (insErr) {
      await db.auth.admin.deleteUser(u.user.id);
      return json({ error: "Testovacího žáka se nepodařilo vytvořit." }, 500);
    }
    ps = { student_id: u.user.id };
  }

  // Zařazení do aktivních tříd a skupin vlastníka (a odebrání z cizích).
  try {
    const sync = await syncPreviewMemberships(db, auth.userId, ps.student_id);
    await db.from("audit_log").insert({
      actor_id: auth.userId, action: "preview_student_sync", target_type: "preview_student", target_id: ps.student_id,
      details: sync,
    });
  } catch (e) {
    console.error("preview sync failed", (e as Error).message);
    return json({ error: "Testovacího žáka se nepodařilo zařadit do vašich tříd. Zkuste to prosím znovu." }, 500);
  }

  const { data: su } = await db.auth.admin.getUserById(ps.student_id);
  if (!su?.user?.email) return json({ error: "Testovací žák nebyl nalezen." }, 404);
  try {
    const session = await issueSession(db, su.user.email);
    await db.from("audit_log").insert({
      actor_id: auth.userId, action: "preview_student_switch", target_type: "preview_student", target_id: ps.student_id,
    });
    return json({ session });
  } catch {
    return json({ error: "Přepnutí se nepodařilo. Zkuste to prosím znovu." }, 500);
  }
});

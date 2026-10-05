// Veřejná funkce: založí dvojici demo účtů (učitel + žák) v Demo škole a vrátí relaci.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  adminClient, countRecent, DEMO_EMAIL_DOMAIN, DEMO_SCHOOL_NAME, generateReturnCode,
  ipHash, issueSession, randomToken, recordEvent,
} from "../_shared/demo.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const cleanTag = (v: unknown): string | null => {
  const s = String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 _-]/g, "").trim().slice(0, 40);
  return s || null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metoda není povolena." }, 405);

  const body = await req.json().catch(() => ({}));
  const role = body?.role === "student" ? "student" : "teacher";
  const eventTag = cleanTag(body?.event_tag);

  const db = adminClient();
  const hash = await ipHash(req);

  if ((await countRecent(db, "create", 60 * 60 * 1000, hash)) >= 20) {
    return json({ error: "Z tohoto připojení už vzniklo hodně testovacích účtů. Zkuste to prosím za hodinu." }, 429);
  }
  if ((await countRecent(db, "create", 24 * 60 * 60 * 1000)) >= 500) {
    return json({ error: "Dnešní kapacita testovacího režimu je vyčerpaná. Zkuste to prosím zítra." }, 429);
  }
  await recordEvent(db, "create", hash);

  const { data: school } = await db.from("schools").select("id, name")
    .eq("name", DEMO_SCHOOL_NAME).eq("is_demo", true).maybeSingle();
  if (!school?.id) return json({ error: "Testovací režim teď není dostupný." }, 503);

  const created: string[] = [];
  try {
    const mk = async (kind: "teacher" | "student") => {
      const email = `demo-${randomToken(8)}@${DEMO_EMAIL_DOMAIN}`;
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: randomToken(32), // nikam se neukládá ani nevrací
        email_confirm: true,
        user_metadata: { role_label: kind, status: "approved", first_name: "Demo", last_name: kind === "teacher" ? "učitel" : "žák", is_demo: true },
      });
      if (error || !data.user) throw new Error("create_user_failed");
      created.push(data.user.id);
      const { error: pErr } = await db.from("profiles").update({
        school_id: school.id, school: school.name, status: "approved",
        first_name: "Demo", last_name: kind === "teacher" ? "učitel" : "žák",
        email_notifications_enabled: false, parent_email_notifications: false,
      }).eq("id", data.user.id);
      if (pErr) throw new Error("profile_failed");
      return { id: data.user.id, email };
    };

    const teacher = await mk("teacher");
    const student = await mk("student");

    const { data: cls, error: cErr } = await db.from("classes").insert({
      name: "Demo třída", description: "", school: school.name, field_of_study: "Demo",
      school_id: school.id, created_by: teacher.id,
    }).select("id").single();
    if (cErr || !cls) throw new Error("class_failed");
    const { error: mErr } = await db.from("class_members").insert({ class_id: cls.id, user_id: student.id });
    if (mErr) throw new Error("member_failed");

    let code = "";
    for (let i = 0; i < 5; i++) {
      code = generateReturnCode();
      const { error } = await db.from("demo_pairs").insert({
        teacher_user_id: teacher.id, student_user_id: student.id, group_id: cls.id,
        return_code: code, event_tag: eventTag, ip_hash: hash,
      });
      if (!error) break;
      if (i === 4) throw new Error("pair_failed");
    }

    const session = await issueSession(db, role === "teacher" ? teacher.email : student.email);
    return json({ session, role, return_code: code });
  } catch (e) {
    console.error("create-demo-session failed", (e as Error).message);
    for (const id of created) await db.auth.admin.deleteUser(id).catch(() => {});
    return json({ error: "Testovací účet se nepodařilo založit. Zkuste to prosím znovu." }, 500);
  }
});

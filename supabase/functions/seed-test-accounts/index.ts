import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PASSWORD = "BezliTest123!";
const SCHOOL_A_ID = "17840203-9bd6-47fc-97c3-726c4da82667";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Require internal secret to protect this seed endpoint
    const secret = req.headers.get("X-Seed-Secret");
    const expected = Deno.env.get("SEED_SECRET") ?? "seed-Bezli-test-2026";
    if (secret !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const log: string[] = [];

    async function upsertUser(opts: {
      email: string;
      first_name: string;
      last_name: string;
      role: "teacher" | "lektor" | "user" | "rodic" | "admin";
      status: "approved" | "pending" | "blocked";
      school_id?: string | null;
    }) {
      const { email, first_name, last_name, role, status, school_id } = opts;
      let userId: string | null = null;

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { first_name, last_name, role_label: role === "user" ? "student" : role, status },
      });

      if (createErr) {
        if (/registered|exists|duplicate/i.test(createErr.message)) {
          // find existing
          let page = 1;
          while (page <= 20 && !userId) {
            const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
            const found = list?.users?.find((u: any) => (u.email || "").toLowerCase() === email.toLowerCase());
            if (found) userId = found.id;
            if (!list?.users || list.users.length < 200) break;
            page++;
          }
          if (userId) {
            await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
          }
        } else {
          throw new Error(`createUser ${email}: ${createErr.message}`);
        }
      } else {
        userId = created.user!.id;
      }

      if (!userId) throw new Error(`No user id for ${email}`);

      await admin.from("profiles").upsert({
        id: userId,
        email,
        first_name,
        last_name,
        school_id: school_id ?? null,
        status,
      }, { onConflict: "id" });

      // Remove auto-inserted 'user' role if we want a specific one
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("user_roles").insert({ user_id: userId, role });

      log.push(`✓ ${email} (${role}, ${status}) → ${userId}`);
      return userId;
    }

    // 1 + 2 Teachers A, B
    const teacherA = await upsertUser({
      email: "ucitel-a@test.Bezli.cz",
      first_name: "Anna", last_name: "Tvůrcová",
      role: "teacher", status: "approved", school_id: SCHOOL_A_ID,
    });
    const teacherB = await upsertUser({
      email: "ucitel-b@test.Bezli.cz",
      first_name: "Barbora", last_name: "Příjemková",
      role: "teacher", status: "approved", school_id: SCHOOL_A_ID,
    });

    // 3 Lektor
    await upsertUser({
      email: "lektor@test.Bezli.cz",
      first_name: "Lukáš", last_name: "Lektor",
      role: "lektor", status: "approved", school_id: null,
    });

    // 4 New second school + licenses
    let schoolB: any;
    const { data: existingB } = await admin.from("schools").select("id, registration_code")
      .eq("name", "ZŠ Testovací, Praha").maybeSingle();
    if (existingB) {
      schoolB = existingB;
      log.push(`= School B already exists (${existingB.id})`);
    } else {
      const { data: codeData } = await admin.rpc("generate_school_registration_code");
      const { data: newSchool, error: sErr } = await admin.from("schools").insert({
        name: "ZŠ Testovací, Praha",
        registration_code: codeData,
      }).select("id, registration_code").single();
      if (sErr) throw new Error(`school B: ${sErr.message}`);
      schoolB = newSchool;
      log.push(`✓ School B created (${newSchool.id}, code=${newSchool.registration_code})`);
    }

    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);

    // License for school B (rust/active)
    const { data: licB } = await admin.from("school_licenses").select("id").eq("school_id", schoolB.id).maybeSingle();
    if (!licB) {
      await admin.from("school_licenses").insert({
        school_id: schoolB.id,
        plan: "rust",
        seats_teachers: 8,
        seats_students: 250,
        status: "active",
        starts_at: new Date().toISOString(),
        expires_at: oneYear.toISOString(),
        billing_cycle: "yearly",
      });
      log.push(`✓ License B: rust/active`);
    } else {
      log.push(`= License B already exists`);
    }

    // License for school A (start/trial) if missing
    const { data: licA } = await admin.from("school_licenses").select("id").eq("school_id", SCHOOL_A_ID).maybeSingle();
    if (!licA) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 30);
      await admin.from("school_licenses").insert({
        school_id: SCHOOL_A_ID,
        plan: "start",
        seats_teachers: 3,
        seats_students: 70,
        status: "trial",
        starts_at: new Date().toISOString(),
        expires_at: trialEnd.toISOString(),
      });
      log.push(`✓ License A: start/trial`);
    } else {
      log.push(`= License A already exists`);
    }

    // 5 Ensure teacher A has a class "Testovací třída 9.A"
    let classId: string;
    const { data: existingClass } = await admin.from("classes")
      .select("id").eq("name", "Testovací třída 9.A").eq("created_by", teacherA).maybeSingle();
    if (existingClass) {
      classId = existingClass.id;
      log.push(`= Class exists (${classId})`);
    } else {
      const { data: newClass, error: cErr } = await admin.from("classes").insert({
        name: "Testovací třída 9.A",
        created_by: teacherA,
        access_code: "TEST9A",
        access_code_active: true,
      }).select("id").single();
      if (cErr) throw new Error(`class: ${cErr.message}`);
      classId = newClass.id;
      log.push(`✓ Class created (${classId})`);
    }

    // Ensure teacher A is class_teacher owner (trigger should have done it)
    await admin.from("class_teachers").upsert({ class_id: classId, user_id: teacherA, role: "owner" }, { onConflict: "class_id,user_id" });

    // Students
    const students = [
      { email: "zak1@test.Bezli.cz", first_name: "Jakub", last_name: "Žák1", status: "approved" as const },
      { email: "zak2@test.Bezli.cz", first_name: "Klára", last_name: "Žák2", status: "approved" as const },
      { email: "zak3@test.Bezli.cz", first_name: "Matěj", last_name: "Žák3", status: "approved" as const },
      { email: "zak4@test.Bezli.cz", first_name: "Nela", last_name: "Žák4", status: "pending" as const },
      { email: "zak5@test.Bezli.cz", first_name: "Ondřej", last_name: "Žák5", status: "blocked" as const },
    ];

    const studentIds: Record<string, string> = {};
    for (const s of students) {
      const id = await upsertUser({ ...s, role: "user", school_id: null });
      studentIds[s.email] = id;
      await admin.from("class_members").upsert({ class_id: classId, user_id: id }, { onConflict: "class_id,user_id" });
    }

    // 6 Parent linked to zak1
    const parentId = await upsertUser({
      email: "rodic@test.Bezli.cz",
      first_name: "Petra", last_name: "Rodičová",
      role: "rodic", status: "approved", school_id: null,
    });
    await admin.from("parent_student_links").upsert(
      { parent_id: parentId, student_id: studentIds["zak1@test.Bezli.cz"] },
      { onConflict: "parent_id,student_id" },
    );
    log.push(`✓ Parent linked to zak1`);

    return new Response(JSON.stringify({
      success: true,
      password: PASSWORD,
      school_b: schoolB,
      teacher_a_id: teacherA,
      teacher_b_id: teacherB,
      class_id: classId,
      log,
    }, null, 2), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message, stack: e.stack }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const schoolName = (body?.school_name ?? "").toString().trim();
    const adminEmail = (body?.admin_email ?? "").toString().trim().toLowerCase();
    const adminPassword = (body?.admin_password ?? "").toString();
    const adminFirstName = (body?.admin_first_name ?? "").toString().trim();
    const adminLastName = (body?.admin_last_name ?? "").toString().trim();

    if (!schoolName || !adminEmail || !adminPassword) {
      return new Response(
        JSON.stringify({ error: "school_name, admin_email and admin_password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (adminPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: "Heslo musí mít alespoň 8 znaků" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(supabaseUrl, anonKey);
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;
    if (claimsError || !callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Pouze system admin
    const { data: callerRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId);
    const isSystemAdmin = callerRoles?.some((r: any) => r.role === "admin");
    if (!isSystemAdmin) {
      return new Response(JSON.stringify({ error: "Pouze administrátor systému může zakládat školy" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Založit školu
    const { data: school, error: schoolErr } = await admin
      .from("schools")
      .insert({ name: schoolName, created_by: callerId })
      .select("id, name")
      .single();
    if (schoolErr || !school) {
      return new Response(JSON.stringify({ error: schoolErr?.message ?? "Nepodařilo se vytvořit školu" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Vytvořit (nebo najít) uživatele
    let adminUserId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        first_name: adminFirstName,
        last_name: adminLastName,
        role_label: "teacher", // bude přepsáno níže na school_admin
      },
    });

    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "";
      const isDuplicate = /already|exists|registered/i.test(msg);
      if (isDuplicate) {
        // najdi existujícího
        let page = 1;
        while (page <= 20 && !adminUserId) {
          const { data: list } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const found = list?.users?.find(
            (u: any) => (u.email || "").toLowerCase() === adminEmail
          );
          if (found) adminUserId = found.id;
          if (!list?.users || list.users.length < 200) break;
          page++;
        }
        if (!adminUserId) {
          // rollback school
          await admin.from("schools").delete().eq("id", school.id);
          return new Response(JSON.stringify({ error: "Uživatel již existuje, ale nepodařilo se ho najít" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        await admin.from("schools").delete().eq("id", school.id);
        return new Response(JSON.stringify({ error: msg || "Nepodařilo se vytvořit uživatele" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      adminUserId = created.user.id;
    }

    // 3) Aktualizovat profile (school_id, status approved, jméno)
    await admin
      .from("profiles")
      .upsert({
        id: adminUserId!,
        email: adminEmail,
        first_name: adminFirstName,
        last_name: adminLastName,
        school_id: school.id,
        status: "approved",
      }, { onConflict: "id" });

    // 4) Přiřadit roli school_admin (a odebrat 'user' pokud existuje – nech ji být, je harmless)
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: adminUserId!, role: "school_admin" });
    if (roleErr && !/duplicate|unique/i.test(roleErr.message)) {
      return new Response(JSON.stringify({ error: roleErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, school, admin_user_id: adminUserId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

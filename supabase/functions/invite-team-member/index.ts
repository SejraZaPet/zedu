import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAuth, hasRole } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);
  if (!(await hasRole(auth.userId, "admin"))) return json({ error: "Forbidden" }, 403);

  try {
    const { email, firstName, lastName } = await req.json();
    const cleanEmail = String(email ?? "").trim().toLowerCase();
    const first = String(firstName ?? "").trim();
    const last = String(lastName ?? "").trim();

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail) || !first || !last) {
      return json({ error: "Neplatné údaje: zkontrolujte jméno, příjmení a e-mail." }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const siteUrl = Deno.env.get("SITE_URL") || req.headers.get("origin") || undefined;

    let userId: string | null = null;

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      cleanEmail,
      {
        data: { first_name: first, last_name: last, role_label: "teacher", status: "approved" },
        redirectTo: siteUrl ? `${siteUrl}/reset-password` : undefined,
      },
    );

    if (inviteError) {
      // Uživatel už možná existuje – zkusíme ho najít a pokračovat
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existing = list?.users?.find((u) => u.email?.toLowerCase() === cleanEmail);
      if (!existing) {
        console.error("invite failed:", inviteError.message);
        return json({ error: `Pozvánku nelze odeslat: ${inviteError.message}` }, 400);
      }
      userId = existing.id;
    } else {
      userId = invited?.user?.id ?? null;
    }

    if (!userId) return json({ error: "Účet nebyl vytvořen." }, 500);

    // Profil (trigger handle_new_user ho obvykle vytvoří; zajistíme idempotentně)
    await admin.from("profiles").upsert(
      { id: userId, email: cleanEmail, first_name: first, last_name: last, status: "approved" },
      { onConflict: "id" },
    );

    const { data: staff, error: staffError } = await admin
      .from("staff_members")
      .upsert({ profile_id: userId, active: true }, { onConflict: "profile_id" })
      .select("id")
      .maybeSingle();

    if (staffError) {
      console.error("staff upsert failed:", staffError.message);
      return json({ error: `Účet vznikl, ale zařazení do týmu selhalo: ${staffError.message}` }, 500);
    }

    return json({ profile_id: userId, staff_member_id: staff?.id ?? null, invited: !inviteError });
  } catch (e: any) {
    console.error("invite-team-member error:", e?.message);
    return json({ error: "Interní chyba" }, 500);
  }
});

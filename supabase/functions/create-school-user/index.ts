// Vytváření žáků a učitelů správcem školy.
//
// Bezpečnostní invarianty (vynucené SERVEROVĚ, nejen v UI):
//  1) Volající musí mít roli 'school_admin' (kontrola nad user_roles service-role klientem).
//  2) Přiřazovaná role smí být POUZE 'user' nebo 'teacher'. Cokoli jiného (zejména
//     'admin' / 'school_admin') je odmítnuto — správce školy nemůže eskalovat práva.
//  3) Škola se NEBERE z requestu, ale výhradně z profilu volajícího (profiles.school_id).
//     Nelze tedy zakládat lidi do cizí školy.
//  4) Účty se zakládají přes auth.admin.createUser (service role), takže se
//     nepřepíše session volajícího (na rozdíl od veřejného signUp).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";
import { buildWelcomeEmail } from "./welcome-email.ts";

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

/** Jediné povolené role pro správce školy. */
const ALLOWED_ROLES = new Set(["user", "teacher"]);

interface IncomingUser {
  first_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  role?: unknown;
  year?: unknown;
  field_of_study?: unknown;
  row_ref?: unknown;
}

interface ResultRow {
  row_ref: string | number | null;
  name: string;
  ok: boolean;
  error?: string;
  email?: string;
  password?: string;
  username?: string;
  student_code?: string;
  pin?: string;
  role?: string;
  user_id?: string;
}

const asText = (v: unknown) => String(v ?? "").trim();

const slug = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

const randomPassword = () => Math.random().toString(36).slice(-8) + "Aa1!";
const randomPin = () => String(Math.floor(1000 + Math.random() * 9000));
const randomStudentCode = () => "ZAK-" + Math.random().toString(36).slice(-4).toUpperCase();

const emailForRole = (first: string, last: string, role: string, taken: Set<string>) => {
  const f = slug(first) || "user";
  const l = slug(last) || "user";
  const domain = role === "teacher" ? "@zedu-lektor.cz" : "@zedu-student.cz";
  const candidates = [`${f}.${l}${domain}`, `${f.charAt(0)}${l}${domain}`];
  for (const c of candidates) if (!taken.has(c)) return c;
  for (let n = 2; n < 100; n++) {
    const c = `${f}.${l}${n}${domain}`;
    if (!taken.has(c)) return c;
  }
  return `${f}.${l}.${Date.now()}${domain}`;
};

const usernameFor = (first: string, last: string, taken: Set<string>) => {
  const base = (slug(first).charAt(0) || "u") + (slug(last) || "user");
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    if (!taken.has(base + n)) return base + n;
  }
  return base + Date.now();
};

/** Doména generovaných zástupných e-mailů — na ty se neposílá uvítací zpráva. */
const isPlaceholderEmail = (email: string) =>
  email.endsWith("@zedu-student.cz") || email.endsWith("@zedu-lektor.cz");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // (1) volající musí být school_admin
  const { data: callerRoles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId);
  const isSchoolAdmin = (callerRoles ?? []).some((r: any) => r.role === "school_admin");
  if (!isSchoolAdmin) {
    return json({ error: "Tato akce je určena pouze správci školy." }, 403);
  }

  // (3) škola se bere z profilu volajícího, nikdy z requestu
  const { data: callerProfile } = await admin
    .from("profiles")
    .select("school_id")
    .eq("id", auth.userId)
    .maybeSingle();
  const schoolId = callerProfile?.school_id as string | null | undefined;
  if (!schoolId) {
    return json({ error: "K vašemu účtu není přiřazena žádná škola." }, 400);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }

  const incoming: IncomingUser[] = Array.isArray(body?.users)
    ? body.users
    : [body as IncomingUser];

  if (incoming.length === 0) return json({ error: "Žádní uživatelé k vytvoření." }, 400);
  if (incoming.length > 300) {
    return json({ error: "Naráz lze importovat nejvýše 300 řádků." }, 400);
  }

  // Klient s JWT volajícího — pro RPC, které se autorizují přes auth.uid()
  const asCaller = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth.authHeader } } },
  );

  // Obsazené e-maily a uživatelská jména (kvůli generování unikátních hodnot)
  const { data: existing } = await admin.from("profiles").select("email, username");
  const takenEmails = new Set<string>();
  const takenUsernames = new Set<string>();
  for (const p of (existing ?? []) as any[]) {
    if (p.email) takenEmails.add(String(p.email).toLowerCase());
    if (p.username) takenUsernames.add(String(p.username));
  }

  const results: ResultRow[] = [];

  for (const raw of incoming) {
    const first = asText(raw.first_name);
    const last = asText(raw.last_name);
    const rowRef = (raw.row_ref as string | number | undefined) ?? null;
    const name = `${first} ${last}`.trim();
    const role = asText(raw.role).toLowerCase();

    // (2) tvrdá serverová validace role
    if (!ALLOWED_ROLES.has(role)) {
      results.push({
        row_ref: rowRef,
        name,
        ok: false,
        error: `Role „${asText(raw.role) || "—"}“ není povolená. Správce školy může zakládat pouze žáky a učitele.`,
      });
      continue;
    }

    if (!first || !last) {
      results.push({ row_ref: rowRef, name, ok: false, error: "Chybí jméno nebo příjmení." });
      continue;
    }

    const providedEmail = asText(raw.email).toLowerCase();
    if (providedEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(providedEmail)) {
      results.push({ row_ref: rowRef, name, ok: false, error: "Neplatný e-mail." });
      continue;
    }
    if (providedEmail && takenEmails.has(providedEmail)) {
      results.push({ row_ref: rowRef, name, ok: false, error: "E-mail už je v systému použitý." });
      continue;
    }

    const email = providedEmail || emailForRole(first, last, role, takenEmails);
    takenEmails.add(email);
    const username = usernameFor(first, last, takenUsernames);
    takenUsernames.add(username);
    const password = randomPassword();
    const studentCode = randomStudentCode();
    const pin = role === "user" ? randomPin() : undefined;

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: first,
        last_name: last,
        role_label: role === "teacher" ? "teacher" : "student",
      },
    });

    const userId = created?.user?.id;
    if (createError || !userId) {
      results.push({
        row_ref: rowRef,
        name,
        ok: false,
        error: /already|exists/i.test(createError?.message ?? "")
          ? "Účet s tímto e-mailem už existuje."
          : (createError?.message || "Účet se nepodařilo vytvořit."),
      });
      continue;
    }

    const yearNum = Number.parseInt(asText(raw.year), 10);
    const { error: profileError } = await admin.from("profiles").upsert(
      {
        id: userId,
        first_name: first,
        last_name: last,
        email,
        school_id: schoolId,
        status: "approved",
        username,
        student_code: studentCode,
        year: Number.isFinite(yearNum) ? yearNum : null,
        field_of_study: asText(raw.field_of_study) || "",
      },
      { onConflict: "id" },
    );
    if (profileError) {
      results.push({ row_ref: rowRef, name, ok: false, error: `Profil: ${profileError.message}` });
      continue;
    }

    // Role — trigger handle_new_user zakládá výchozí 'user'; učiteli ji vymění.
    if (role === "teacher") {
      await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "user");
    }
    const { error: roleError } = await admin
      .from("user_roles")
      .upsert({ user_id: userId, role }, { onConflict: "user_id,role", ignoreDuplicates: true });
    if (roleError) {
      results.push({ row_ref: rowRef, name, ok: false, error: `Role: ${roleError.message}` });
      continue;
    }

    // Přihlašovací údaje pro tisk/PIN — RPC se autorizují přes auth.uid() volajícího,
    // proto se volají jeho JWT (profil už je ve stejné škole, takže projdou).
    await asCaller.rpc("set_login_password", { _profile_id: userId, _password: password });
    if (pin) {
      await asCaller.rpc("set_user_pin_for", { _profile_id: userId, _pin: pin });
    }

    await admin.from("audit_log").insert({
      actor_id: auth.userId,
      action: "user_created",
      target_type: "user",
      target_id: userId,
      details: { name, role, source: "school_admin", school_id: schoolId },
    });

    // Uvítací e-mail jen na skutečnou adresu, ne na generovanou zástupnou
    if (!isPlaceholderEmail(email)) {
      try {
        const mail = buildWelcomeEmail({
          firstName: first,
          email,
          password,
          role,
          username,
          studentCode: role === "user" ? studentCode : undefined,
        });
        await admin.functions.invoke("send-email", {
          body: { to: email, subject: mail.subject, html: mail.html, text: mail.text },
        });
      } catch (e) {
        console.warn("welcome email failed", (e as any)?.message);
      }
    }

    results.push({
      row_ref: rowRef,
      name,
      ok: true,
      email,
      password,
      username,
      student_code: studentCode,
      pin,
      role,
      user_id: userId,
    });
  }

  const created = results.filter((r) => r.ok).length;
  return json({ created, failed: results.length - created, results });
});

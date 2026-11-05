// notify-email: e-mailová kopie in-app notifikace pro žáky a učitele.
// Volá se asynchronně z DB triggeru na `notifications` (pg_net) s X-Internal-Secret.
// Body: { notification_id }  |  admin JWT: { action: "domain_status" }
import { createClient } from "npm:@supabase/supabase-js@2.95.0";
import { isPreviewEmail } from "../_shared/preview-students.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { getInternalSecret } from "../_shared/internal-secret.ts";
import { requireAuth, hasRole } from "../_shared/auth.ts";
import { isTooOld } from "../_shared/email-delivery.ts";
import { buildAssignmentEmail, shouldEmail } from "../_shared/assignment-email.ts";

const APP_URL = "https://www.bezli.cz";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function shell(title: string, body: string, url: string | null, button = "Otevřít v Bezli") {
  return `
  <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1A1F2C; background: #F8FAFC;">
    <div style="background: linear-gradient(135deg, #0E8F9A 0%, #AD87C9 100%); padding: 24px; border-radius: 14px 14px 0 0; text-align: center;">
      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">Bezli<span style="color:#a5f3fc;">.cz</span></h1>
    </div>
    <div style="background:#ffffff; padding: 24px; border-radius: 0 0 14px 14px;">
      <h2 style="margin: 0 0 12px; font-size: 20px;">${esc(title)}</h2>
      <p style="white-space: pre-line; line-height: 1.5;">${esc(body)}</p>
      ${url ? `<div style="text-align:center; margin: 24px 0 8px;">
        <a href="${esc(url)}" style="background:#0E8F9A; color:#ffffff; padding:12px 22px; border-radius:14px; text-decoration:none; font-weight:600; display:inline-block;">${esc(button)}</a>
      </div>` : ""}
      <p style="font-size:12px; color:#64748B; text-align:center; margin-top:18px;">
        E-mailové notifikace lze vypnout v nastavení profilu na <a href="${APP_URL}/profil" style="color:#0E8F9A;">bezli.cz</a>.
      </p>
    </div>
  </div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const body = await req.json().catch(() => ({}));

  if (body?.action === "domain_status") {
    const auth = await requireAuth(req, { allowServiceRole: true });
    if (!auth.ok) return json(auth.body, auth.status);
    if (!auth.isServiceRole && !(await hasRole(auth.userId, "admin"))) return json({ error: "Forbidden" }, 403);
    const key = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY");
    if (!key) return json({ error: "RESEND_API_KEY missing" }, 503);
    const r = await fetch("https://api.resend.com/domains", { headers: { Authorization: `Bearer ${key}` } });
    const d = await r.json().catch(() => ({}));
    return json({ status: r.status, domains: (d?.data ?? []).map((x: any) => ({ name: x.name, status: x.status })) });
  }

  const secret = await getInternalSecret("notify_parent_internal_secret");
  if (!secret || req.headers.get("X-Internal-Secret") !== secret) return json({ error: "Unauthorized" }, 401);

  const id = typeof body?.notification_id === "string" ? body.notification_id : null;
  if (!id) return json({ error: "notification_id required" }, 400);

  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: n } = await db.from("notifications").select("id, recipient_id, type, title, body, link, payload, created_at").eq("id", id).maybeSingle();
  if (!n) return json({ skipped: "not_found" });
  if (isTooOld((n as any).created_at)) {
    console.log("skipped: too_old", id);
    return json({ skipped: "too_old" });
  }

  const { data: pv } = await db.from("preview_students").select("student_id").eq("student_id", n.recipient_id).maybeSingle();
  if (pv) return json({ skipped: "preview_student" });

  const { data: p } = await db.from("profiles").select("email, email_notifications_enabled").eq("id", n.recipient_id).maybeSingle();
  if (!p?.email || (p as any).email_notifications_enabled === false) return json({ skipped: "disabled_or_no_email" });
  if (isPreviewEmail(p.email)) return json({ skipped: "preview_student" });

  // Rodiče řeší samostatný kanál (parent_email_notifications).
  const { data: roles } = await db.from("user_roles").select("role").eq("user_id", n.recipient_id);
  const rs = (roles ?? []).map((r: any) => r.role);
  if (rs.includes("rodic") && !rs.some((r: string) => r !== "rodic")) return json({ skipped: "parent" });

  const link = n.link ? (String(n.link).startsWith("http") ? String(n.link) : `${APP_URL}${String(n.link).startsWith("/") ? "" : "/"}${n.link}`) : null;
  let title = String(n.title ?? "Nová notifikace");
  let text = String(n.body ?? "");
  let subject = title;
  let button = "Otevřít v Bezli";

  // Nově zveřejněná položka pro žáka: podrobná šablona (úkol / materiál / oznámení).
  const aid = (n as any).payload?.assignment_id;
  if ((n as any).type === "assignment_new" && typeof aid === "string" && String(n.link ?? "").startsWith("/student/")) {
    const { data: a } = await db.from("assignments")
      .select("title, description, deadline, settings, teacher_id, class_id, group_id, subject_id").eq("id", aid).maybeSingle();
    if (a) {
      if (!shouldEmail((a as any).settings)) return json({ skipped: "kind_or_option" });
      const [t, c, g, s] = await Promise.all([
        db.from("profiles").select("first_name, last_name").eq("id", (a as any).teacher_id).maybeSingle(),
        (a as any).class_id ? db.from("classes").select("name").eq("id", (a as any).class_id).maybeSingle() : Promise.resolve({ data: null }),
        (a as any).group_id ? db.from("subject_groups").select("name").eq("id", (a as any).group_id).maybeSingle() : Promise.resolve({ data: null }),
        (a as any).subject_id ? db.from("subjects").select("name").eq("id", (a as any).subject_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const e = buildAssignmentEmail({
        title: String((a as any).title ?? ""), description: (a as any).description, deadline: (a as any).deadline,
        settings: (a as any).settings, teacher: [(t.data as any)?.first_name, (t.data as any)?.last_name].filter(Boolean).join(" ") || null,
        target: (g.data as any)?.name ?? (c.data as any)?.name ?? null, subject: (s.data as any)?.name ?? null,
        url: link ?? APP_URL,
      });
      subject = e.subject; title = e.heading; text = e.lines.join("\n\n"); button = e.button;
    }
  }

  // send-email zapisuje email_log (pending → sent/failed).
  const r = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_KEY}` },
    body: JSON.stringify({
      to: p.email,
      subject,
      html: shell(title, text, link, button),
      text: `${title}\n\n${text}${link ? `\n\n${button}: ${link}` : ""}`,
      emailType: "notification",
    }),
  }).catch((e) => { console.error("send-email call failed", e); return null; });

  return json({ ok: !!r?.ok });
});

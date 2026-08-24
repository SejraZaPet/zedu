import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAuth } from "../_shared/auth.ts";

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { data: allowed, error: permError } = await admin.rpc("has_staff_permission", {
    _module: "crm",
    _user_id: auth.userId,
    _need_edit: true,
  });
  if (permError || !allowed) return json({ error: "Forbidden" }, 403);

  let payload: {
    organizationIds?: unknown;
    tagFilter?: unknown;
    subject?: unknown;
    body?: unknown;
    contactCategory?: unknown;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const subject = typeof payload.subject === "string" ? payload.subject.trim() : "";
  const bodyText = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!subject || subject.length > 300 || !bodyText || bodyText.length > 20000) {
    return json({ error: "Invalid input" }, 400);
  }

  let organizationIds: string[] = Array.isArray(payload.organizationIds)
    ? payload.organizationIds.filter((v): v is string => typeof v === "string")
    : [];
  const tagFilter = Array.isArray(payload.tagFilter)
    ? payload.tagFilter.filter((v): v is string => typeof v === "string")
    : [];

  if (tagFilter.length) {
    const { data: tagged } = await admin
      .from("crm_organization_tags")
      .select("organization_id")
      .in("tag_id", tagFilter);
    const taggedIds = [...new Set((tagged ?? []).map((r) => r.organization_id as string))];
    organizationIds = organizationIds.length
      ? organizationIds.filter((id) => taggedIds.includes(id))
      : taggedIds;
  }

  if (!organizationIds.length) return json({ sent: 0, failed: 0, recipients: 0 });

  const allowedCategories = ["vedeni", "ucitel", "jine"];
  const contactCategory =
    typeof payload.contactCategory === "string" && allowedCategories.includes(payload.contactCategory)
      ? payload.contactCategory
      : null;

  let contactQuery = admin
    .from("crm_contacts")
    .select("id, name, email")
    .in("organization_id", organizationIds)
    .eq("marketing_consent", true)
    .is("unsubscribed_at", null);
  // Bez kategorie posíláme jen hlavním kontaktům (dosavadní chování).
  contactQuery = contactCategory
    ? contactQuery.eq("contact_category", contactCategory)
    : contactQuery.eq("is_primary", true);
  const { data: contacts, error: contactError } = await contactQuery;

  if (contactError) return json({ error: "Failed to load contacts" }, 500);

  const recipients = (contacts ?? []).filter((c) => typeof c.email === "string" && c.email.includes("@"));
  if (!recipients.length) return json({ sent: 0, failed: 0, recipients: 0 });

  const unsubBase = `${SUPABASE_URL}/functions/v1/crm-unsubscribe`;
  let sent = 0;
  let failed = 0;

  for (const c of recipients) {
    const unsubUrl = `${unsubBase}?c=${c.id}`;
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#1f2933;line-height:1.6">
      <p>${escapeHtml(c.name ?? "").length ? `Dobrý den, ${escapeHtml(c.name)},` : "Dobrý den,"}</p>
      <div>${escapeHtml(bodyText).replace(/\n/g, "<br />")}</div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0" />
      <p style="font-size:12px;color:#6b7280">
        Tento e-mail jste obdrželi na základě souhlasu se zasíláním informací od Bezli.
        <a href="${unsubUrl}" style="color:#6b7280">Odhlásit se ze zasílání</a>
      </p>
    </div>`;

    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to: c.email, subject, html }),
    });
    await res.text();
    if (res.ok) sent++;
    else failed++;
  }

  return json({ sent, failed, recipients: recipients.length });
});

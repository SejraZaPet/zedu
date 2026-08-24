// Denní kontrola blížící se expirace školních licencí.
// Pro každou licenci (trial/active) s expires_at v hranici 30/14/7/1 dní
// pošle e-mail školnímu adminovi a na info@bezli.cz. Idempotence přes
// tabulku school_license_reminders (UNIQUE license_id + threshold_days).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getInternalSecret } from "../_shared/internal-secret.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const THRESHOLDS = [30, 14, 7, 1];
const INTERNAL_RECIPIENT = "info@bezli.cz";
const APP_URL = "https://www.bezli.cz";

function escapeHtml(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const CRON_SECRET = await getInternalSecret("cron_internal_secret");
  if (!CRON_SECRET || req.headers.get("X-Cron-Secret") !== CRON_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = Date.now();
  const horizon = new Date(now + 31 * 86400_000).toISOString();

  const { data: licenses, error } = await supabase
    .from("school_licenses")
    .select("id, school_id, plan, status, expires_at")
    .in("status", ["trial", "active"])
    .not("expires_at", "is", null)
    .gte("expires_at", new Date(now).toISOString())
    .lte("expires_at", horizon);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let sent = 0;
  let skipped = 0;

  for (const lic of licenses ?? []) {
    const daysLeft = Math.ceil(
      (new Date(lic.expires_at as string).getTime() - now) / 86400_000,
    );
    const threshold = THRESHOLDS.find((t) => daysLeft <= t);
    if (threshold === undefined) continue;

    // Idempotence
    const { data: existing } = await supabase
      .from("school_license_reminders")
      .select("id")
      .eq("license_id", lic.id)
      .eq("threshold_days", threshold)
      .maybeSingle();
    if (existing) {
      skipped++;
      continue;
    }

    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", lic.school_id)
      .maybeSingle();
    const schoolName = school?.name ?? "Neznámá škola";

    // Školní admini dané školy
    const { data: schoolProfiles } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("school_id", lic.school_id);
    const ids = (schoolProfiles ?? []).map((p: any) => p.id);
    let adminEmails: string[] = [];
    if (ids.length > 0) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "school_admin")
        .in("user_id", ids);
      const adminIds = new Set((roles ?? []).map((r: any) => r.user_id));
      adminEmails = (schoolProfiles ?? [])
        .filter((p: any) => adminIds.has(p.id) && p.email)
        .map((p: any) => p.email as string);
    }

    const dateLabel = new Date(lic.expires_at as string).toLocaleDateString("cs-CZ");
    const dayWord = threshold === 1 ? "den" : threshold < 5 ? "dny" : "dní";
    const subject = `Licence školy ${schoolName} vyprší za ${threshold} ${dayWord}`;
    const html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1f2937;">
        <h2 style="margin-top:0;">Blíží se expirace licence</h2>
        <p>Licence školy <strong>${escapeHtml(schoolName)}</strong> vyprší za <strong>${threshold} ${dayWord}</strong> (${dateLabel}).</p>
        <p>Pro obnovení nebo změnu balíčku nás prosím kontaktujte na
          <a href="mailto:info@bezli.cz">info@bezli.cz</a>.</p>
        <p style="font-size:12px;color:#6b7280;">Automatická zpráva z platformy
          <a href="${APP_URL}">bezli.cz</a></p>
      </div>`;
    const text = `Licence školy ${schoolName} vyprší za ${threshold} ${dayWord} (${dateLabel}).\n\nPro obnovení nás kontaktujte na info@bezli.cz.\n\n— bezli.cz`;

    const recipients = Array.from(new Set([...adminEmails, INTERNAL_RECIPIENT]));
    let ok = false;
    for (const to of recipients) {
      const { error: mailErr } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html, text },
      });
      if (mailErr) {
        console.error("[check-license-expiring] send-email failed", to, mailErr.message);
      } else {
        ok = true;
        sent++;
      }
    }

    if (ok) {
      await supabase
        .from("school_license_reminders")
        .insert({ license_id: lic.id, threshold_days: threshold });
    }
  }

  return new Response(
    JSON.stringify({ ok: true, scanned: licenses?.length ?? 0, sent, skipped }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});

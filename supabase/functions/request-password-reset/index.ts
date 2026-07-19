import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GENERIC_MESSAGE =
  "Pokud e-mail existuje v systému, poslali jsme odkaz pro obnovení hesla.";
const APP_URL = "https://www.zedu.cz";
const RATE_LIMIT = 3;
const RATE_WINDOW_MIN = 15;

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", enc);
  return toHex(hash);
}

function generic() {
  return new Response(JSON.stringify({ message: GENERIC_MESSAGE }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  try {
    const { email } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") return generic();

    const normalized = email.trim().toLowerCase();
    if (normalized.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return generic();
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const identifier = `pwreset:${normalized}`;
    const windowStart = new Date(Date.now() - RATE_WINDOW_MIN * 60 * 1000).toISOString();
    const { count } = await admin
      .from("login_attempts")
      .select("id", { count: "exact", head: true })
      .eq("identifier", identifier)
      .gte("attempted_at", windowStart);
    if ((count ?? 0) >= RATE_LIMIT) {
      return generic();
    }
    await admin.from("login_attempts").insert({ identifier, success: false });

    // Find user by email (profiles first, fallback to auth.users listing)
    let userId: string | null = null;
    let firstName = "";
    const { data: prof } = await admin
      .from("profiles")
      .select("id, first_name")
      .eq("email", normalized)
      .maybeSingle();
    if (prof?.id) {
      userId = prof.id;
      firstName = prof.first_name || "";
    } else {
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const found = list?.users?.find(
        (u: any) => (u.email || "").toLowerCase() === normalized
      );
      if (found) userId = found.id;
    }

    if (!userId) return generic();

    // Generate token
    const raw = toHex(crypto.getRandomValues(new Uint8Array(32)).buffer);
    const tokenHash = await sha256Hex(raw);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    const { error: insErr } = await admin.from("password_reset_tokens").insert({
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (insErr) {
      console.error("insert token error", insErr.message);
      return generic();
    }

    const resetUrl = `${APP_URL}/reset-heslo?token=${raw}`;
    const html = `
<div style="font-family: Lato, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1A1F2C; background: #F8FAFC;">
  <div style="background: linear-gradient(135deg, #0E8F9A 0%, #AD87C9 100%); padding: 32px 24px; border-radius: 14px 14px 0 0; text-align: center;">
    <h1 style="margin: 0; font-size: 28px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">ZEdu<span style="color: #a5f3fc;">.cz</span></h1>
    <p style="margin: 8px 0 0; opacity: 0.95; color: #ffffff; font-size: 14px;">Obnovení hesla</p>
  </div>
  <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 14px 14px;">
    <h2 style="margin-top: 0; color: #1A1F2C;">Obnovení hesla</h2>
    <p style="color: #1A1F2C;">${firstName ? `Dobrý den ${firstName},` : "Dobrý den,"}</p>
    <p style="color: #1A1F2C;">obdrželi jsme žádost o obnovení hesla k vašemu účtu na ZEdu.cz. Pro nastavení nového hesla klikněte na tlačítko níže.</p>
    <div style="text-align: center; margin: 28px 0;">
      <a href="${resetUrl}" style="background: #0E8F9A; color: #ffffff; padding: 12px 24px; border-radius: 14px; text-decoration: none; display: inline-block; font-weight: 600;">
        Nastavit nové heslo
      </a>
    </div>
    <p style="font-size: 13px; color: #64748B;">Odkaz je platný <strong>1 hodinu</strong>. Pokud jste o obnovení hesla nežádali, tento email prosím ignorujte — vaše heslo zůstane beze změny.</p>
    <p style="font-size: 12px; color: #64748B; word-break: break-all;">Pokud tlačítko nefunguje, zkopírujte tento odkaz do prohlížeče:<br/>${resetUrl}</p>
  </div>
  <div style="text-align: center; padding: 16px; font-size: 12px; color: #64748B;">
    <p style="margin: 0;">© ZEdu.cz — <a href="${APP_URL}" style="color: #0E8F9A; text-decoration: none;">www.zedu.cz</a></p>
  </div>
</div>`;

    const text = `Obnovení hesla ZEdu.cz\n\nPro nastavení nového hesla otevřete tento odkaz (platný 1 hodinu):\n\n${resetUrl}\n\nPokud jste o obnovení hesla nežádali, tento email ignorujte.`;

    // Invoke send-email with service-role auth (allowed by send-email).
    try {
      const res = await fetch(
        `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            to: normalized,
            subject: "Obnovení hesla – ZEdu.cz",
            html,
            text,
          }),
        }
      );
      if (!res.ok) console.error("send-email failed", res.status, await res.text());
    } catch (e) {
      console.error("send-email invoke error", (e as Error).message);
    }

    return generic();
  } catch (e) {
    console.error("request-password-reset error", (e as Error).message);
    return generic();
  }
});

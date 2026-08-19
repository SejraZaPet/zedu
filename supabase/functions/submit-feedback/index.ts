import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Best-effort in-memory rate limit per IP (edge instance-scoped)
const recentByIp = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 3;

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
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const message = String(body?.message ?? "").trim();
    const pageContext = String(body?.page_context ?? body?.pageContext ?? "").slice(0, 500);

    if (!message) {
      return new Response(JSON.stringify({ error: "Zpráva je prázdná" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (message.length > 4000) {
      return new Response(JSON.stringify({ error: "Zpráva je příliš dlouhá" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const arr = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= MAX_PER_WINDOW) {
      return new Response(
        JSON.stringify({ error: "Příliš mnoho zpráv, zkuste to prosím za chvíli." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    arr.push(now);
    recentByIp.set(ip, arr);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Volitelně identifikuj přihlášeného uživatele (funkce je veřejná).
    let userId: string | null = null;
    let userEmail: string | null = null;
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await admin.auth.getUser(token);
      if (data?.user) {
        userId = data.user.id;
        userEmail = data.user.email ?? null;
      }
    }

    const { data: inserted, error: insertError } = await admin
      .from("feedback_reports")
      .insert({ user_id: userId, page_context: pageContext || null, message })
      .select("id, created_at")
      .single();

    if (insertError) {
      console.error("feedback insert failed:", insertError.message);
      return new Response(JSON.stringify({ error: "Zprávu se nepodařilo uložit" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let emailSent = false;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured — feedback saved without email");
    } else {
      const rows: Array<[string, string]> = [
        ["Stránka / kontext", pageContext || "—"],
        ["Uživatel", userEmail ?? (userId ? userId : "nepřihlášený")],
        ["Zpráva", message],
      ];
      const html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
        <h2 style="margin:0 0 12px;">Nová zpětná vazba z aplikace ZEdu</h2>
        <table cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; background:#f8fafc; border-radius:12px;">
          ${rows
            .map(
              ([k, v]) => `<tr>
              <td style="width:180px; font-weight:600; vertical-align:top; border-bottom:1px solid #e2e8f0;">${escapeHtml(k)}</td>
              <td style="border-bottom:1px solid #e2e8f0; white-space:pre-wrap;">${escapeHtml(v) || "—"}</td>
            </tr>`,
            )
            .join("")}
        </table>
        <p style="margin-top:16px; font-size:12px; color:#94a3b8;">Odesláno přes BETA štítek v aplikaci.</p>
      </div>`;
      const text = rows.map(([k, v]) => `${k}: ${v || "—"}`).join("\n");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: "ZEdu zpětná vazba <noreply@zedu.cz>",
          to: ["info@zedu.cz"],
          ...(userEmail ? { reply_to: userEmail } : {}),
          subject: `Zpětná vazba z aplikace – ${pageContext || "neznámá stránka"}`,
          html,
          text,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        console.error("Resend error", res.status, errBody);
      } else {
        emailSent = true;
      }
    }

    return new Response(JSON.stringify({ ok: true, id: inserted?.id, emailSent }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("submit-feedback error:", (e as Error)?.message);
    return new Response(JSON.stringify({ error: "Interní chyba" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

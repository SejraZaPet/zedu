const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory rate limit per IP (best-effort; edge instance-scoped)
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
    const body = await req.json();
    const {
      name,
      email,
      phone,
      organization,
      role,
      plan,
      studentCount,
      message,
      website, // honeypot
      startedAt, // client timestamp
    } = body ?? {};

    // Honeypot: bots often fill hidden fields
    if (website && String(website).trim() !== "") {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Too-fast submission (< 2s) — likely bot
    if (typeof startedAt === "number" && Date.now() - startedAt < 2000) {
      return new Response(JSON.stringify({ error: "Too fast" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!name || !email || !plan) {
      return new Response(JSON.stringify({ error: "Chybí povinná pole" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (String(name).length > 200 || String(email).length > 255 || String(message ?? "").length > 5000) {
      return new Response(JSON.stringify({ error: "Vstup je příliš dlouhý" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return new Response(JSON.stringify({ error: "Neplatný e-mail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const now = Date.now();
    const arr = (recentByIp.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
    if (arr.length >= MAX_PER_WINDOW) {
      return new Response(JSON.stringify({ error: "Příliš mnoho pokusů, zkuste to prosím později." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    arr.push(now);
    recentByIp.set(ip, arr);

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || Deno.env.get("RESEND_KEY");
    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY not configured");
      return new Response(JSON.stringify({ error: "Email služba není nakonfigurovaná" }), {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rows: Array<[string, string]> = [
      ["Jméno", String(name)],
      ["E-mail", String(email)],
      ["Telefon", String(phone ?? "")],
      ["Škola / organizace", String(organization ?? "")],
      ["Role", String(role ?? "")],
      ["Balíček", String(plan)],
      ["Počet žáků (odhad)", String(studentCount ?? "")],
      ["Zpráva", String(message ?? "")],
    ];

    const html = `
      <div style="font-family: Lato, Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1e293b;">
        <h2 style="margin:0 0 12px;">Nová poptávka po licenci ZEdu</h2>
        <p style="margin:0 0 16px; color:#64748b;">Balíček: <strong>${escapeHtml(plan)}</strong></p>
        <table cellpadding="8" cellspacing="0" style="width:100%; border-collapse:collapse; background:#f8fafc; border-radius:12px;">
          ${rows
            .map(
              ([k, v]) => `
            <tr>
              <td style="width:200px; font-weight:600; vertical-align:top; border-bottom:1px solid #e2e8f0;">${escapeHtml(k)}</td>
              <td style="border-bottom:1px solid #e2e8f0; white-space:pre-wrap;">${escapeHtml(v) || "—"}</td>
            </tr>`,
            )
            .join("")}
        </table>
        <p style="margin-top:16px; font-size:12px; color:#94a3b8;">Odesláno z veřejného formuláře /licence na zedu.cz</p>
      </div>
    `;
    const text = rows.map(([k, v]) => `${k}: ${v || "—"}`).join("\n");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ZEdu poptávky <noreply@zedu.cz>",
        to: ["info@zedu.cz"],
        reply_to: String(email),
        subject: `Nová poptávka po licenci ZEdu – ${plan}`,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error("Resend error", res.status, errBody);
      return new Response(JSON.stringify({ error: "Odeslání se nepodařilo" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("send-license-inquiry error:", e?.message);
    return new Response(JSON.stringify({ error: "Interní chyba" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

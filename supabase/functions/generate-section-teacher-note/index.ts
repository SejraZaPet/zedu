/**
 * generate-section-teacher-note — krátká poznámka pro učitele k textu JEDNÉ sekce lekce.
 * Vrací { note: string }. Výstup je určen jen učiteli (nezobrazuje se žákům).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const key = Deno.env.get("LOVABLE_API_KEY");
    if (!key) return json({ error: "AI není nakonfigurována." }, 500);

    const body = await req.json().catch(() => ({}));
    const sectionTitle = typeof body?.sectionTitle === "string" ? body.sectionTitle.trim().slice(0, 300) : "";
    const sectionText = typeof body?.sectionText === "string" ? body.sectionText.trim().slice(0, 6000) : "";
    const lessonTitle = typeof body?.lessonTitle === "string" ? body.lessonTitle.trim().slice(0, 300) : "";
    if (sectionText.length + sectionTitle.length < 10) {
      return json({ error: "Sekce neobsahuje dost textu pro návrh poznámky." }, 400);
    }

    const instructions = `Jsi zkušený český pedagog. Napiš STRUČNOU poznámku pro učitele k jedné sekci pracovního listu.
Vycházej výhradně z dodaného textu sekce. Piš česky, věcně, max. 4 krátké odrážky začínající "- ":
- kdy/jak sekci v hodině použít,
- doporučený čas v minutách,
- na co dát pozor (typické chyby nebo miskoncepce žáků),
- tip k vyhodnocení.
Bez nadpisu, bez úvodu a závěru, bez markdownu kromě odrážek.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": key,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        instructions,
        input: `Lekce: ${lessonTitle || "(neuvedeno)"}\nSekce: ${sectionTitle}\n\nText sekce:\n${sectionText}`,
        stream: true,
        store: false,
        reasoning: { effort: "low" },
      }),
    });

    if (!res.ok || !res.body) {
      const t = await res.text().catch(() => "");
      console.error("AI gateway error:", res.status, t);
      if (res.status === 429) return json({ error: "Příliš mnoho požadavků, zkuste to za chvíli." }, 429);
      if (res.status === 402) return json({ error: "Nedostatek kreditů pro AI generování." }, 402);
      if (res.status === 403) return json({ error: "AI generování není pro tento prostor povoleno." }, 403);
      return json({ error: "Chyba AI služby" }, 500);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let text = "";
    let completed = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") text += ev.delta;
          if (ev.type === "response.completed") completed = ev.response?.output_text ?? "";
        } catch { /* ignore partial */ }
      }
    }
    const note = (text || completed).trim();
    if (!note) return json({ error: "AI nevrátila poznámku" }, 500);
    return json({ note, ai_generated: true });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

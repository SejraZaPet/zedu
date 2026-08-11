// Krátký text pro blok slidu (AI). Vrací jeden odstavec nebo odrážky
// v kontextu nadpisu slidu a názvu lekce. Lovable AI Gateway (Gemini Flash).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const { requireAuth } = await import("../_shared/auth.ts");
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY není nastavený" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const headline = String(body.headline ?? "").trim().slice(0, 300);
    const lessonTitle = String(body.lessonTitle ?? "").trim().slice(0, 200);
    const existingText = String(body.existingText ?? "").trim().slice(0, 2000);
    const kind = body.kind === "heading" ? "heading" : "paragraph";

    if (!headline && !lessonTitle && !existingText) {
      return new Response(
        JSON.stringify({ error: "Doplňte nejprve nadpis slidu nebo část textu, ať má AI z čeho vycházet." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const systemPrompt =
      kind === "heading"
        ? `Jsi pedagogický asistent. Vrať JEDEN krátký, výstižný nadpis slidu v češtině (max 8 slov). Bez uvozovek, bez markdownu, bez vysvětlování.`
        : `Jsi pedagogický asistent pro středoškolské výukové prezentace.
Vrať JEDEN stručný odstavec (2–4 věty) v češtině vhodný na slide prezentace.
Piš věcně, srozumitelně pro žáky, bez markdownu, bez uvozovek a bez úvodních frází.`;

    const userPrompt = `Lekce: ${lessonTitle || "neuvedeno"}
Nadpis slidu: ${headline || "neuvedeno"}
${existingText ? `Stávající text bloku (navaž nebo jej vylepši):\n"""\n${existingText}\n"""` : ""}`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Překročen limit AI dotazů. Zkuste to za chvíli." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "Vyčerpaný kredit AI." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI gateway selhalo" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const text = String(aiData?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) {
      return new Response(JSON.stringify({ error: "AI nevrátila text" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("generate-slide-text error", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

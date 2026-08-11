// AI shlukování otevřených odpovědí žáků (Zeď, slovní mrak).
// Vstup: { texts: string[], question?: string }
// Výstup: { clusters: [{ label, summary, count, examples[] }], outliers: string[] }
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const TOOL = {
  type: "function",
  function: {
    name: "cluster_responses",
    description:
      "Rozděl odpovědi žáků do 2–6 tematických skupin. Vše česky.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["clusters", "outliers"],
      properties: {
        clusters: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "summary", "count", "examples"],
            properties: {
              label: { type: "string", maxLength: 60, description: "Krátký název skupiny." },
              summary: { type: "string", maxLength: 300, description: "1–2 věty, co skupina vyjadřuje." },
              count: { type: "integer", minimum: 1, description: "Počet odpovědí ve skupině." },
              examples: {
                type: "array",
                maxItems: 3,
                items: { type: "string", maxLength: 200 },
                description: "Až 3 typické odpovědi (citace).",
              },
            },
          },
        },
        outliers: {
          type: "array",
          maxItems: 5,
          items: { type: "string", maxLength: 200 },
          description: "Odpovědi, které nepatří do žádné skupiny.",
        },
      },
    },
  },
} as const;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY není nastaven" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const texts: string[] = Array.isArray(body.texts)
      ? body.texts.map((t: unknown) => String(t ?? "").trim()).filter(Boolean).slice(0, 200)
      : [];
    const question: string = (body.question ?? "").toString().slice(0, 300);

    if (texts.length < 2) {
      return new Response(
        JSON.stringify({ error: "Pro shlukování potřebuji alespoň 2 odpovědi." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const userPrompt = [
      question ? `Otázka pro žáky: ${question}` : null,
      `Odpovědi (${texts.length}):`,
      ...texts.map((t, i) => `${i + 1}. ${t.slice(0, 300)}`),
      "Rozděl je do tematických skupin a stručně popiš každou skupinu.",
    ].filter(Boolean).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Jsi asistent učitele. Shlukuješ otevřené odpovědi žáků do tematických skupin. Odpovídáš česky, věcně, bez hodnocení jednotlivých žáků. Nikdy si nevymýšlíš odpovědi, které nebyly zadány.",
          },
          { role: "user", content: userPrompt },
        ],
        tools: [TOOL],
        tool_choice: { type: "function", function: { name: "cluster_responses" } },
      }),
    });

    if (aiResp.status === 429) {
      return new Response(
        JSON.stringify({ error: "Příliš mnoho požadavků. Zkuste to za chvíli." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (aiResp.status === 402) {
      return new Response(
        JSON.stringify({ error: "Vyčerpaný kredit AI. Doplňte ho v Nastavení." }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!aiResp.ok) {
      const txt = await aiResp.text();
      return new Response(JSON.stringify({ error: "AI chyba", detail: txt }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    let parsed: { clusters?: unknown[]; outliers?: unknown[] } = {};
    try {
      parsed = typeof args === "string" ? JSON.parse(args) : args ?? {};
    } catch {
      parsed = {};
    }

    return new Response(
      JSON.stringify({
        clusters: Array.isArray(parsed.clusters) ? parsed.clusters : [],
        outliers: Array.isArray(parsed.outliers) ? parsed.outliers : [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

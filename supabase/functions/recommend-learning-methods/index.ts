import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { goal, subject, customInstructions, methods } = await req.json();
    if (!Array.isArray(methods) || methods.length === 0) {
      return new Response(JSON.stringify({ error: "Chybí katalog metod" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const catalogText = methods
      .slice(0, 60)
      .map(
        (m: any) =>
          `- id=${m.id} | ${m.name} | kategorie=${m.category ?? "?"} | obtížnost=${m.difficulty ?? "?"} | čas=${m.time_range ?? "?"}\n  ${(m.description ?? "").slice(0, 200)}`,
      )
      .join("\n");

    const sysPrompt = `Jsi zkušený český pedagog. Na základě cíle hodiny doporuč 2–3 nejvhodnější výukové metody z dodaného katalogu. U každé krátce vysvětli (1–2 věty), proč se hodí pro daný cíl. Vracej pouze id metod z katalogu.`;

    const userPrompt = [
      goal ? `Cíl hodiny: ${goal}` : "",
      subject ? `Předmět: ${subject}` : "",
      customInstructions ? `Pokyny učitele: ${customInstructions}` : "",
      `\nKatalog metod:\n${catalogText}`,
    ]
      .filter(Boolean)
      .join("\n");

    const allowedIds = methods.map((m: any) => m.id);

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_methods",
              description: "Doporuč 2–3 výukové metody.",
              parameters: {
                type: "object",
                properties: {
                  recommendations: {
                    type: "array",
                    minItems: 2,
                    maxItems: 3,
                    items: {
                      type: "object",
                      properties: {
                        method_id: { type: "string", enum: allowedIds },
                        reason: { type: "string" },
                      },
                      required: ["method_id", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["recommendations"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_methods" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      if (resp.status === 402)
        return new Response(JSON.stringify({ error: "Nedostatek kreditů pro AI generování." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc)
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    const parsed = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-learning-methods error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

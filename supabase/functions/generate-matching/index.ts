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

    const { terms, definitions } = await req.json();
    if (!terms || !Array.isArray(terms) || terms.length < 2) {
      return new Response(JSON.stringify({ error: "Potřebuji alespoň 2 pojmy v poli 'terms'." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog. Tvoříš přiřazovací (matching) aktivity pro české školy.

PRAVIDLA:
- Pro každý pojem vytvoř přesnou, stručnou definici/popis (1 věta)
- Pokud jsou dodány definice, oprav případné faktické chyby a uprav je tak, aby byly jednoznačné
- leftItems = pojmy, rightItems = odpovídající definice (ve STEJNÉM pořadí, 1:1 mapování)
- Počet leftItems musí být roven počtu rightItems
- Vše česky (cs-CZ)`;

    const userPrompt = `Vytvoř matching aktivitu pro tyto pojmy:

Pojmy: ${terms.join(", ")}
${definitions && definitions.length > 0 ? `Navržené definice (mohou obsahovat chyby): ${definitions.join(" | ")}` : "Definice vygeneruj sám."}

Vrať leftItems (pojmy) a rightItems (správné definice) ve stejném pořadí.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_matching",
              description: "Vytvoří matching aktivitu s pojmy a definicemi.",
              parameters: {
                type: "object",
                properties: {
                  leftItems: {
                    type: "array",
                    items: { type: "string" },
                    description: "Pojmy (levá strana)",
                  },
                  rightItems: {
                    type: "array",
                    items: { type: "string" },
                    description: "Definice (pravá strana, stejné pořadí jako leftItems)",
                  },
                },
                required: ["leftItems", "rightItems"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_matching" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatek kreditů pro AI generování." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-matching error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

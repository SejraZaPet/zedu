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

    const { slide, instruction } = await req.json();
    if (!slide || typeof slide !== "object") {
      return new Response(JSON.stringify({ error: "Missing required field: slide (object)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instr = instruction || "Vylepši slide – přidej více detailů a příkladů.";

    const systemPrompt = `Jsi zkušený český pedagog a editor vzdělávacího obsahu.

PRAVIDLA:
- Dostaneš JSON slidu a instrukci k úpravě
- Uprav slide přesně podle instrukce
- Zachovej původní strukturu a klíče JSON objektu
- Můžeš přidat nové klíče, pokud to instrukce vyžaduje (např. "notes", "explanation", "imageHint")
- NIKDY neodstraňuj existující klíče, pokud instrukce explicitně neříká jinak
- Pokud slide obsahuje correctIndex, ověř že po úpravě stále ukazuje na správnou odpověď
- Vše česky (cs-CZ)`;

    const userPrompt = `Uprav tento slide podle instrukce:

SLIDE (JSON):
${JSON.stringify(slide, null, 2)}

INSTRUKCE: ${instr}

Vrať upravený slide jako JSON.`;

    // Build properties schema dynamically from the input slide keys
    const slideKeys = Object.keys(slide);
    const properties: Record<string, any> = {};
    for (const key of slideKeys) {
      const val = slide[key];
      if (Array.isArray(val)) {
        properties[key] = { type: "array", items: { type: "string" } };
      } else if (typeof val === "number") {
        properties[key] = { type: "number" };
      } else if (typeof val === "boolean") {
        properties[key] = { type: "boolean" };
      } else {
        properties[key] = { type: "string" };
      }
    }
    // Allow additional fields the AI might add
    properties["notes"] = { type: "string", description: "Poznámky k úpravě" };
    properties["explanation"] = { type: "string", description: "Vysvětlení" };
    properties["imageHint"] = { type: "string", description: "Popis obrázku k přidání" };

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
              name: "update_slide",
              description: "Vrátí upravený slide.",
              parameters: {
                type: "object",
                properties,
                required: slideKeys,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "update_slide" } },
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
    return new Response(JSON.stringify({ slide: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("edit-slide error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

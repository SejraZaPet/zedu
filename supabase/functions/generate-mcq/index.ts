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

    const { topic, keywords, difficulty } = await req.json();
    if (!topic || !keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return new Response(JSON.stringify({ error: "Missing required fields: topic, keywords" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const diff = difficulty || "střední";

    const systemPrompt = `Jsi zkušený český pedagog. Tvoříš kvalitní testové otázky s výběrem odpovědí (MCQ) pro české školy.

PRAVIDLA:
- Vygeneruj přesně 1 otázku s výběrem odpovědí
- Otázka musí mít minimálně 4 možnosti odpovědí
- Přesně jedna odpověď je správná, ostatní jsou distraktory
- Distraktory musí být věrohodné, ale jednoznačně nesprávné
- Obtížnost: ${diff}
- Vše piš česky (cs-CZ)
- correctIndex je 0-based index správné odpovědi v poli options`;

    const userPrompt = `Vytvoř MCQ otázku:

Téma: ${topic}
Klíčová slova: ${keywords.join(", ")}
Obtížnost: ${diff}`;

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
              name: "create_mcq",
              description: "Vytvoří MCQ otázku s možnostmi a správnou odpovědí.",
              parameters: {
                type: "object",
                properties: {
                  question: { type: "string", description: "Text otázky" },
                  options: {
                    type: "array",
                    minItems: 4,
                    items: { type: "string" },
                    description: "Možnosti odpovědí (min. 4)",
                  },
                  correctIndex: {
                    type: "number",
                    description: "0-based index správné odpovědi v poli options",
                  },
                },
                required: ["question", "options", "correctIndex"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_mcq" } },
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
    console.error("generate-mcq error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

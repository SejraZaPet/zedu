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

    const { lessonTitle, lessonContext, count, types } = await req.json();

    if (!lessonContext || typeof lessonContext !== "string" || lessonContext.trim().length < 20) {
      return new Response(
        JSON.stringify({ error: "Lekce neobsahuje dostatek textu pro generování pracovního listu." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const safeCount = Math.max(1, Math.min(20, Number(count) || 5));
    const allowedTypes: string[] = Array.isArray(types) && types.length > 0
      ? types.filter((t) => ["mcq", "true_false", "short_answer"].includes(t))
      : ["mcq"];

    const systemPrompt = `Jsi zkušený český pedagog. Vytváříš kvalitní pracovní listy z poskytnutého obsahu lekce.

PRAVIDLA:
- Generuj přesně ${safeCount} otázek
- Otázky se MUSÍ vázat na poskytnutý obsah lekce, ne na obecné znalosti
- Povolené typy: ${allowedTypes.join(", ")}
- Pro typ "mcq": minimálně 4 možnosti, právě jedna správná, distraktory věrohodné
- Pro typ "true_false": jednoznačné tvrzení, correctAnswer je "true" nebo "false"
- Pro typ "short_answer": krátká očekávaná odpověď (1-5 slov), correctAnswer obsahuje vzorovou odpověď
- Vše piš česky (cs-CZ)
- correctIndex je 0-based index správné odpovědi v poli options (jen pro mcq)`;

    const userPrompt = `Téma lekce: ${lessonTitle || "Nepojmenovaná lekce"}

Obsah lekce:
${lessonContext.slice(0, 8000)}

Vytvoř pracovní list s ${safeCount} otázkami.`;

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
              name: "create_worksheet",
              description: "Vytvoří pracovní list s otázkami z obsahu lekce.",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["mcq", "true_false", "short_answer"] },
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctIndex: { type: "number" },
                        correctAnswer: { type: "string" },
                      },
                      required: ["type", "question"],
                    },
                  },
                },
                required: ["questions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_worksheet" } },
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
    console.error("generate-lesson-worksheet error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

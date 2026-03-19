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

    const { videoUrl, checkpoints, topic } = await req.json();
    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "Missing required field: videoUrl" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog. Tvoříš interaktivní video aktivity s kontrolními body (checkpointy) pro české školy.

PRAVIDLA:
- Pro každý checkpoint vytvoř smysluplnou otázku s možnostmi odpovědí
- Otázky by měly ověřovat porozumění obsahu videa v daném čase
- Každá otázka má mít 3–4 možnosti odpovědí
- correctIndex musí být platný index v poli options (0-based)
- Pokud dostaneš existující checkpointy, vylepši jejich otázky a odpovědi
- Pokud checkpointy chybí, navrhni 3–5 checkpointů v rozumných časových intervalech
- Vše piš česky (cs-CZ)`;

    const hasCheckpoints = checkpoints && checkpoints.length > 0;

    const userPrompt = hasCheckpoints
      ? `Video URL: ${videoUrl}
${topic ? `Téma: ${topic}` : ""}

Existující checkpointy (vylepši otázky a odpovědi):
${JSON.stringify(checkpoints, null, 2)}

Zachovej časy (timeSec), ale vylepši otázky – udělej je jasnější, přidej lepší distraktory.`
      : `Video URL: ${videoUrl}
${topic ? `Téma: ${topic}` : ""}

Navrhni 3–5 kontrolních bodů (checkpointů) pro toto video. Zvol rozumné časy a vytvoř otázky ověřující porozumění.`;

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
              name: "create_video_checkpoints",
              description: "Vytvoří interaktivní video s kontrolními body.",
              parameters: {
                type: "object",
                properties: {
                  videoUrl: { type: "string", description: "URL videa" },
                  checkpoints: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        timeSec: { type: "number", description: "Čas v sekundách" },
                        question: { type: "string", description: "Otázka pro studenta" },
                        options: {
                          type: "array",
                          minItems: 3,
                          items: { type: "string" },
                          description: "Možnosti odpovědí",
                        },
                        correctIndex: { type: "number", description: "Index správné odpovědi (0-based)" },
                      },
                      required: ["timeSec", "question", "options", "correctIndex"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["videoUrl", "checkpoints"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_video_checkpoints" } },
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
    console.error("generate-video-checkpoints error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

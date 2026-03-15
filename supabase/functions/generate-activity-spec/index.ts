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

    const { activityType, prompt, gradeBand, assets, content } = await req.json();
    if (!activityType || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields: activityType, prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Jsi zkušený český pedagog a didaktik pro interaktivní vzdělávání. Tvoříš strukturované specifikace aktivit pro live výuku ve třídě (projektor + zařízení žáků).

PRAVIDLA:
- Výstup musí odpovídat zvolenému activityType
- Vždy přidej worksheetMapping (jak aktivitu převést do pracovního listu)
- Vždy přidej accessibility metadata (ariaLabel, alts)
- Neuvádej žádná osobní data žáků (PII)
- Vše česky (cs-CZ)
- Pro live režim: projektor ukazuje zadání, zařízení sbírá odpovědi

Typy aktivit:
- mcq: Výběr z více možností (choices, correctIndex, explanation)
- matching: Spojování dvojic (pairs s left/right)
- hotspot: Klikání na oblasti obrázku (regions s x,y,width,height,label)
- interactive_video: Video s kontrolními body (checkpoints s timestampSec a otázkou)`;

    const userPrompt = `Vytvoř ActivitySpec pro:

Typ: ${activityType}
Zadání: ${prompt}
Ročník: ${gradeBand || "nespecifikováno"}
${assets?.imageUrl ? `Obrázek: ${assets.imageUrl} (alt: ${assets.imageAlt || ""})` : ""}
${assets?.videoUrl ? `Video: ${assets.videoUrl} (${assets.videoDurationSec || "?"}s)` : ""}
${content ? `Obsah: ${JSON.stringify(content)}` : ""}`;

    // Build model schema based on activity type
    const modelSchemas: Record<string, any> = {
      mcq: {
        type: "object",
        properties: {
          choices: { type: "array", items: { type: "string" }, minItems: 2 },
          correctIndex: { type: "number" },
          explanation: { type: "string" },
        },
        required: ["choices", "correctIndex", "explanation"],
      },
      matching: {
        type: "object",
        properties: {
          pairs: {
            type: "array",
            items: {
              type: "object",
              properties: { left: { type: "string" }, right: { type: "string" } },
              required: ["left", "right"],
            },
          },
        },
        required: ["pairs"],
      },
      hotspot: {
        type: "object",
        properties: {
          imageUrl: { type: "string" },
          regions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                x: { type: "number" }, y: { type: "number" },
                width: { type: "number" }, height: { type: "number" },
                label: { type: "string" },
              },
              required: ["x", "y", "width", "height", "label"],
            },
          },
        },
        required: ["regions"],
      },
      interactive_video: {
        type: "object",
        properties: {
          videoUrl: { type: "string" },
          checkpoints: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestampSec: { type: "number" },
                question: { type: "string" },
                choices: { type: "array", items: { type: "string" } },
                correctIndex: { type: "number" },
              },
              required: ["timestampSec", "question", "choices", "correctIndex"],
            },
          },
        },
        required: ["checkpoints"],
      },
    };

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
              name: "create_activity_spec",
              description: "Vytvoří strukturovanou specifikaci aktivity pro live výuku.",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["mcq", "matching", "hotspot", "interactive_video"] },
                  prompt: { type: "string", description: "Zadání aktivity pro žáky" },
                  delivery: {
                    type: "object",
                    properties: {
                      mode: { type: "string", enum: ["live", "self-paced"] },
                      projectorPolicy: { type: "string", description: "Co se zobrazí na projektoru" },
                      devicePolicy: { type: "string", description: "Co se zobrazí na zařízení žáka" },
                    },
                    required: ["mode", "projectorPolicy", "devicePolicy"],
                  },
                  model: modelSchemas[activityType] || { type: "object" },
                  scoring: {
                    type: "object",
                    properties: {
                      maxPoints: { type: "number" },
                      partialCredit: { type: "boolean" },
                      timeBonusEnabled: { type: "boolean" },
                      scoringRules: { type: "string" },
                    },
                    required: ["maxPoints", "partialCredit"],
                  },
                  worksheetMapping: {
                    type: "object",
                    properties: {
                      printFormat: { type: "string", description: "Jak se aktivita vytiskne do pracovního listu" },
                      answerKeyIncluded: { type: "boolean" },
                      instructions: { type: "string" },
                    },
                    required: ["printFormat", "answerKeyIncluded", "instructions"],
                  },
                  accessibility: {
                    type: "object",
                    properties: {
                      ariaLabel: { type: "string" },
                      alts: {
                        type: "object",
                        additionalProperties: { type: "string" },
                      },
                    },
                    required: ["ariaLabel"],
                  },
                },
                required: ["type", "prompt", "delivery", "model", "scoring", "worksheetMapping", "accessibility"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_activity_spec" } },
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

    const activity = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ activity }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-activity-spec error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

    const { activityType, prompt, gradeBand, assets, content, feedbackMode, deliveryMode } = await req.json();
    if (!activityType || !prompt) {
      return new Response(JSON.stringify({ error: "Missing required fields: activityType, prompt" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isStudentPaced = deliveryMode === "student_paced";
    const fbMode = feedbackMode || "immediate";

    const studentPacedRules = `
- Režim: STUDENT-PACED – žák pracuje zcela sám, BEZ projektoru
- Veškerý obsah (zadání, instrukce, obrázky, video) se zobrazí přímo na zařízení žáka
- projectorPolicy: "Nepoužívá se – vše na zařízení žáka"
- devicePolicy musí obsahovat kompletní instrukce, aby žák věděl přesně co dělat
- Přidej deviceInstructions: krok-za-krokem návod pro žáka (min. 2 kroky)
- Přidej progressIndicator popisující jak žák vidí svůj postup`;

    const teacherLedRules = `
- Režim: LIVE – učitel řídí aktivitu, projektor ukazuje zadání
- projectorPolicy: co se zobrazí na projektoru (zadání, obrázek, video)
- devicePolicy: co žák vidí a dělá na svém zařízení`;

    const feedbackRules = fbMode === "immediate"
      ? `- Feedback: IMMEDIATE – po každé odpovědi žák okamžitě vidí, zda odpověděl správně, s vysvětlením
- U každé otázky/odpovědi přidej feedbackCorrect (text pro správnou odpověď) a feedbackIncorrect (text pro špatnou)
- Přidej hint pro nápovědu před odpovědí`
      : `- Feedback: DELAYED – žák vidí výsledky až po dokončení celé aktivity
- Přidej summaryFeedback s celkovým vyhodnocením
- U každé otázky přidej explanation, které se ukáže ve shrnutí`;

    const systemPrompt = `Jsi zkušený český pedagog a didaktik pro interaktivní vzdělávání. Tvoříš strukturované specifikace aktivit.

PRAVIDLA:
- Výstup musí odpovídat zvolenému activityType
- Vždy přidej worksheetMapping (jak aktivitu převést do pracovního listu)
- Vždy přidej accessibility metadata (ariaLabel, alts, keyboardNav)
- Neuváděj žádná osobní data žáků (PII)
- Vše česky (cs-CZ)
${isStudentPaced ? studentPacedRules : teacherLedRules}
${feedbackRules}

Typy aktivit:
- mcq: Výběr z více možností (choices, correctIndex, explanation, hint)
- matching: Spojování dvojic (pairs s left/right)
- hotspot: Klikání na oblasti obrázku (regions s x,y,width,height,label)
- interactive_video: Video s kontrolními body (checkpoints s timestampSec a otázkou)`;

    const userPrompt = `Vytvoř ActivitySpec pro:

Typ: ${activityType}
Zadání: ${prompt}
Ročník: ${gradeBand || "nespecifikováno"}
Režim doručení: ${isStudentPaced ? "student-paced (žák sám)" : "live (učitel řídí)"}
Zpětná vazba: ${fbMode === "immediate" ? "okamžitá" : "odložená (po dokončení)"}
${assets?.imageUrl ? `Obrázek: ${assets.imageUrl} (alt: ${assets.imageAlt || ""})` : ""}
${assets?.videoUrl ? `Video: ${assets.videoUrl} (${assets.videoDurationSec || "?"}s)` : ""}
${content ? `Obsah: ${JSON.stringify(content)}` : ""}`;

    const modelSchemas: Record<string, any> = {
      mcq: {
        type: "object",
        properties: {
          choices: { type: "array", items: { type: "string" }, minItems: 2 },
          correctIndex: { type: "number" },
          explanation: { type: "string" },
          hint: { type: "string" },
          feedbackCorrect: { type: "string" },
          feedbackIncorrect: { type: "string" },
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
          hint: { type: "string" },
          feedbackCorrect: { type: "string" },
          feedbackIncorrect: { type: "string" },
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
                feedbackCorrect: { type: "string" },
                feedbackIncorrect: { type: "string" },
              },
              required: ["x", "y", "width", "height", "label"],
            },
          },
          hint: { type: "string" },
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
                explanation: { type: "string" },
                hint: { type: "string" },
                feedbackCorrect: { type: "string" },
                feedbackIncorrect: { type: "string" },
              },
              required: ["timestampSec", "question", "choices", "correctIndex"],
            },
          },
          summaryFeedback: { type: "string" },
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
              description: "Vytvoří strukturovanou specifikaci aktivity.",
              parameters: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["mcq", "matching", "hotspot", "interactive_video"] },
                  prompt: { type: "string", description: "Zadání aktivity pro žáky" },
                  delivery: {
                    type: "object",
                    properties: {
                      mode: { type: "string", enum: ["live", "student_paced"] },
                      projectorPolicy: { type: "string", description: "Co se zobrazí na projektoru (nebo 'nepoužívá se')" },
                      devicePolicy: { type: "string", description: "Co se zobrazí na zařízení žáka" },
                      deviceInstructions: {
                        type: "array",
                        items: { type: "string" },
                        description: "Krok-za-krokem instrukce pro žáka (student-paced)",
                      },
                      progressIndicator: { type: "string", description: "Jak žák vidí svůj postup" },
                    },
                    required: ["mode", "projectorPolicy", "devicePolicy"],
                  },
                  feedback: {
                    type: "object",
                    properties: {
                      mode: { type: "string", enum: ["immediate", "delayed"] },
                      summaryFeedback: { type: "string", description: "Celkové shrnutí po dokončení (delayed mode)" },
                    },
                    required: ["mode"],
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
                      printFormat: { type: "string" },
                      answerKeyIncluded: { type: "boolean" },
                      instructions: { type: "string" },
                    },
                    required: ["printFormat", "answerKeyIncluded", "instructions"],
                  },
                  accessibility: {
                    type: "object",
                    properties: {
                      ariaLabel: { type: "string" },
                      keyboardNav: { type: "string", description: "Jak ovládat klávesnicí" },
                      alts: {
                        type: "object",
                        additionalProperties: { type: "string" },
                      },
                    },
                    required: ["ariaLabel"],
                  },
                },
                required: ["type", "prompt", "delivery", "feedback", "model", "scoring", "worksheetMapping", "accessibility"],
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

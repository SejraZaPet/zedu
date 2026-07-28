import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALL_WORKSHEET_TYPES = [
  "mcq", "true_false", "fill_blank", "matching", "ordering",
  "short_answer", "open_answer", "section_header", "write_lines",
  "instruction_box", "two_boxes", "flow_steps",
  "sorting", "flashcards", "word_search",
];

type OutputType = "worksheet" | "single_activity" | "activity_mix" | "presentation";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const {
      images = [],
      extractedText = "",
      outputType,
      activityTypes,
      itemCount = 8,
      title = "",
    } = body ?? {};

    const outType = outputType as OutputType;
    if (!["worksheet", "single_activity", "activity_mix", "presentation"].includes(outType)) {
      return new Response(JSON.stringify({ error: "Neplatný outputType" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasImages = Array.isArray(images) && images.length > 0;
    const hasText = typeof extractedText === "string" && extractedText.trim().length > 20;
    if (!hasImages && !hasText) {
      return new Response(JSON.stringify({ error: "Chybí vstup – nahraj fotku nebo text." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const safeCount = Math.max(1, Math.min(20, Number(itemCount) || 8));
    const allowedTypes: string[] = Array.isArray(activityTypes) && activityTypes.length > 0
      ? activityTypes.filter((t: string) => ALL_WORKSHEET_TYPES.includes(t))
      : ALL_WORKSHEET_TYPES;

    // ─── PRESENTATION MODE ───────────────────────────────────────────
    if (outType === "presentation") {
      const systemPrompt = `Jsi expert na tvorbu učitelských prezentací. Z předloženého materiálu vytvoř sadu slidů pro živou prezentaci ve třídě.
PRAVIDLA:
- Vytvoř přesně ${safeCount} slidů.
- Používej pouze dva typy slidů: "explain" (výkladový – nadpis + krátký text) a "mcq" (otázka + 4 možnosti + index správné odpovědi 0–3).
- Střídej explain a mcq (přibližně 60/40).
- Nadpisy krátké (max 8 slov). Body u explain slidů: 2–5 vět.
- MCQ otázky vycházejí z materiálu, jedna správná odpověď.
- Jazyk: čeština (cs-CZ), formálně ale srozumitelně.`;

      const userTextInstruction = hasImages
        ? `Vytvoř prezentaci z přiložených obrázků materiálu. ${title ? `Téma: ${title}.` : ""}`
        : `Vytvoř prezentaci z tohoto materiálu:\n\n${extractedText.slice(0, 12000)}\n\n${title ? `Téma: ${title}.` : ""}`;

      const userContent = hasImages
        ? [
            { type: "text", text: userTextInstruction },
            ...images.slice(0, 6).map((b64: string) => ({
              type: "image_url",
              image_url: { url: b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}` },
            })),
          ]
        : userTextInstruction;

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          tools: [{
            type: "function",
            function: {
              name: "create_presentation",
              description: "Vytvoří sadu slidů pro živou prezentaci.",
              parameters: {
                type: "object",
                properties: {
                  slides: {
                    type: "array", minItems: 1,
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["explain", "mcq"] },
                        headline: { type: "string" },
                        body: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correctIndex: { type: "integer", minimum: 0, maximum: 3 },
                      },
                      required: ["type", "headline"],
                    },
                  },
                },
                required: ["slides"],
                additionalProperties: false,
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "create_presentation" } },
        }),
      });

      if (!response.ok) return relayError(response);
      const data = await response.json();
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall) throw new Error("AI nevrátila strukturovaný výstup");
      const result = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── WORKSHEET / ACTIVITY MODES (WorksheetSpec items) ────────────
    const modeGuidance =
      outType === "worksheet"
        ? "Vytvoř kompletní pracovní list – mix různých typů úloh z povoleného seznamu."
        : outType === "single_activity"
          ? `Vytvoř aktivitu založenou POUZE na typu "${allowedTypes[0]}". Všechny bloky musí být tohoto typu (kromě volitelného úvodního section_header).`
          : "Vytvoř kombinovanou aktivitu – použij pouze povolené typy, střídej je smysluplně.";

    const systemPrompt = `Jsi expert na tvorbu pracovních listů a učebních aktivit pro české školy. Ze vstupního materiálu vygeneruj obsah.
PRAVIDLA:
- ${modeGuidance}
- Vygeneruj přesně ${safeCount} bloků.
- Použij VÝHRADNĚ informace z materiálu, nevymýšlej fakta.
- Povolené typy: ${allowedTypes.join(", ")}.
- Každý blok MUSÍ mít: type, prompt, points (int), difficulty ("easy"|"medium"|"hard"), timeEstimateSec (int).
- section_header / instruction_box / write_lines / two_boxes / flow_steps mají points = 0.
- mcq: "choices" (přesně 4) + "correctAnswer" = text správné volby.
- true_false: "correctAnswer" = "true" nebo "false".
- fill_blank: "blankText" obsahující "___" místo klíčových slov.
- matching: "matchPairs" (3–5 { left, right }).
- ordering: "orderItems" (3–6 ve správném pořadí).
- short_answer / open_answer: "correctAnswer" = vzorová odpověď.
- write_lines: "lineCount" (3–8), "lineStyle" ("dotted"|"solid"|"dashed").
- instruction_box: "instructionVariant", "instructionIcon".
- two_boxes: leftTitle, leftContent, rightTitle, rightContent.
- flow_steps: "flowSteps" (3–6 kroků).
- sorting: sortingCategories (2–4 {id,label}), sortingItems (6–12 {text,categoryId}).
- flashcards: (4–8 {front,back}).
- word_search: wordSearchWords (4–8 slov VELKÝMI PÍSMENY bez diakritiky).
- Jazyk: čeština (cs-CZ).`;

    const userTextInstruction = hasImages
      ? `Vygeneruj obsah z přiložených obrázků materiálu.${title ? ` Téma: ${title}.` : ""}`
      : `Vygeneruj obsah z tohoto materiálu:\n\n${extractedText.slice(0, 12000)}${title ? `\n\nTéma: ${title}.` : ""}`;

    const userContent = hasImages
      ? [
          { type: "text", text: userTextInstruction },
          ...images.slice(0, 6).map((b64: string) => ({
            type: "image_url",
            image_url: { url: b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}` },
          })),
        ]
      : userTextInstruction;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [{
          type: "function",
          function: {
            name: "create_worksheet_items",
            description: "Vytvoří bloky pracovního listu / aktivity.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                items: {
                  type: "array", minItems: 1,
                  items: {
                    type: "object",
                    properties: {
                      type: { type: "string", enum: allowedTypes },
                      prompt: { type: "string" },
                      points: { type: "number" },
                      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                      timeEstimateSec: { type: "number" },
                      choices: { type: "array", items: { type: "string" } },
                      correctAnswer: { type: "string" },
                      blankText: { type: "string" },
                      matchPairs: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { left: { type: "string" }, right: { type: "string" } },
                          required: ["left", "right"],
                        },
                      },
                      orderItems: { type: "array", items: { type: "string" } },
                      lineCount: { type: "number" },
                      lineStyle: { type: "string", enum: ["dotted", "solid", "dashed"] },
                      instructionVariant: { type: "string", enum: ["blue", "yellow", "green", "purple"] },
                      instructionIcon: { type: "string", enum: ["info", "video", "write", "discuss", "group"] },
                      leftTitle: { type: "string" }, leftContent: { type: "string" },
                      rightTitle: { type: "string" }, rightContent: { type: "string" },
                      flowSteps: { type: "array", items: { type: "string" } },
                      sortingCategories: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { id: { type: "string" }, label: { type: "string" } },
                          required: ["id", "label"],
                        },
                      },
                      sortingItems: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { text: { type: "string" }, categoryId: { type: "string" } },
                          required: ["text", "categoryId"],
                        },
                      },
                      flashcards: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: { front: { type: "string" }, back: { type: "string" } },
                          required: ["front", "back"],
                        },
                      },
                      wordSearchWords: { type: "array", items: { type: "string" } },
                      wordSearchSize: { type: "number" },
                    },
                    required: ["type", "prompt"],
                  },
                },
              },
              required: ["items"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "create_worksheet_items" } },
      }),
    });

    if (!response.ok) return relayError(response);
    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("AI nevrátila strukturovaný výstup");
    const result = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-content-from-material error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function relayError(response: Response) {
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
  return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
    status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ACTIVITY_KINDS = [
  "quiz",
  "worksheet",
  "live_game",
  "lesson_block",
  "offline_activity",
  "discussion",
] as const;

const INTERACTIVE_TYPES = [
  "mcq",
  "true_false",
  "fill_blank",
  "matching",
  "ordering",
  "short_answer",
  "open_answer",
  "flashcards",
  "sorting",
  "crossword",
  "word_search",
  "flow_steps",
  "image_label",
  "image_hotspot",
];

const PHASE_KEYS = ["uvod", "motivace", "hlavni", "procviceni", "reflexe", "zaver"];

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

    const {
      sourceText = "",
      sourceTitle = "",
      subject = "",
      gradeBand = "",
      methods = [],
      customInstructions = "",
      thinkingTypes = [],
      curriculumContext = "",
    } = await req.json();

    if (!Array.isArray(methods) || methods.length === 0) {
      return new Response(JSON.stringify({ error: "Vyberte alespoň jednu metodu." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const VALID_THINKING = ["creative", "logical", "practical"] as const;
    const thinkingList: string[] = Array.isArray(thinkingTypes)
      ? thinkingTypes.filter((t: any) => VALID_THINKING.includes(t))
      : [];
    const thinkingLabels: Record<string, string> = {
      creative: "kreativní uvažování (originální nápady, alternativy, propojování napříč obory)",
      logical: "logické uvažování (argumentace, dedukce, hledání příčin a důsledků, důkazy)",
      practical: "praktické uplatnění (přenos do reálného života, řešení konkrétních problémů, dovednosti)",
    };
    const wantsModelSituation = thinkingList.length > 0;
    const truncatedCurriculum = String(curriculumContext || "").trim().slice(0, 6000);


    const methodsText = methods
      .map(
        (m: any, i: number) =>
          `${i + 1}. ${m.name} (id=${m.id})\n   ${m.description ?? ""}${m.tips ? `\n   Tip: ${m.tips}` : ""}`,
      )
      .join("\n");

    const truncatedSource = String(sourceText || "").slice(0, 12000);

    const thinkingInstructions = wantsModelSituation
      ? `\n\nZAMĚŘENÍ MYŠLENÍ (aktivováno učitelem):\nZařaď do fází konkrétní aktivity a/nebo otázky rozvíjející tyto typy uvažování:\n${thinkingList.map((t) => `- ${thinkingLabels[t]}`).join("\n")}\nAktivity musí být konkrétní (ne obecné fráze), navázané na téma lekce, a jasně adresovat daný typ myšlení.\n\nMODELOVÁ SITUACE (povinné):\nVygeneruj jednu konkrétní modelovou situaci z praxe (scenario) – 1–2 věty popisující realistický scénář, kde se probíraná vědomost/dovednost musí uplatnit na základě principu (ne mechanicky). K situaci doplň jednu otázku nebo úkol pro žáka (task), který ověří pochopení principu.`
      : "";

    const curriculumInstructions = truncatedCurriculum
      ? `\n\nŠKOLNÍ VZDĚLÁVACÍ PLÁN (ŠVP) učitele pro tento předmět – uč podle něj v místech, kde je to relevantní; nekopíruj jej doslova, ale respektuj cíle, výstupy a doporučené postupy:\n${truncatedCurriculum}`
      : "";

    const systemPrompt = `Jsi Bezlai – zkušený český pedagog a designer výukových aktivit. Na základě zdrojového materiálu a vybraných výukových metod navrhneš strukturu jedné vyučovací hodiny (typicky 45 minut) rozdělené do 6 fází: uvod, motivace, hlavni, procviceni, reflexe, zaver.

Pravidla:
- Popiš každou fázi 2–4 větami – konkrétně, ne obecně.
- U vhodných fází navrhni konkrétní aktivity. Každá aktivita má "kind" a "title".
- Povolené hodnoty "kind": ${ACTIVITY_KINDS.join(", ")}. Pokud navrhuješ interaktivní aktivitu (quiz), doplň v title typ v závorce – povolené typy: ${INTERACTIVE_TYPES.join(", ")}. Př.: "Rychlý kvíz na klíčové pojmy (mcq)".
- Uveď stručné pedagogické zdůvodnění (methodNotes) pro každou zvolenou metodu – proč se pro toto téma hodí.
- Sečtený čas ve fázích by měl odpovídat cca 45 minutám.
- Piš česky, formálně (vykání pro učitele).${thinkingInstructions}${curriculumInstructions}`;

    const userPrompt = [
      sourceTitle ? `Název zdrojové lekce: ${sourceTitle}` : "",
      subject ? `Předmět: ${subject}` : "",
      gradeBand ? `Ročník/stupeň: ${gradeBand}` : "",
      customInstructions ? `Pokyny učitele: ${customInstructions}` : "",
      `\nVybrané metody:\n${methodsText}`,
      truncatedSource ? `\nZdrojový materiál (extrahovaný text):\n${truncatedSource}` : "\n(Bez zdrojového materiálu – navrhni obecnou strukturu pro dané téma.)",
    ]
      .filter(Boolean)
      .join("\n");


    const methodIds = methods.map((m: any) => m.id);

    const phaseSchema = {
      type: "object",
      properties: {
        timeMin: { type: "string", description: "Doporučená doba v minutách (např. '5' nebo '10-15')" },
        description: { type: "string" },
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: [...ACTIVITY_KINDS] },
              title: { type: "string" },
            },
            required: ["kind", "title"],
            additionalProperties: false,
          },
        },
      },
      required: ["timeMin", "description", "activities"],
      additionalProperties: false,
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_lesson",
              description: "Navrhni strukturu lekce podle vybraných metod.",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Navrhovaný název lekce" },
                  subject: { type: "string" },
                  summary: {
                    type: "string",
                    description: "Krátké shrnutí (2-3 věty), jak vybrané metody utvářejí hodinu.",
                  },
                  phases: {
                    type: "object",
                    properties: {
                      uvod: phaseSchema,
                      motivace: phaseSchema,
                      hlavni: phaseSchema,
                      procviceni: phaseSchema,
                      reflexe: phaseSchema,
                      zaver: phaseSchema,
                    },
                    required: PHASE_KEYS,
                    additionalProperties: false,
                  },
                  methodNotes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        method_id: { type: "string", enum: methodIds },
                        note: { type: "string" },
                      },
                      required: ["method_id", "note"],
                      additionalProperties: false,
                    },
                  },
                  modelSituation: {
                    type: "object",
                    description: wantsModelSituation
                      ? "Konkrétní modelová situace z praxe demonstrující princip a otázku/úkol pro žáka."
                      : "Nepovinné – vynechej, pokud učitel nevyžádal zaměření myšlení.",
                    properties: {
                      scenario: { type: "string" },
                      task: { type: "string" },
                    },
                    required: ["scenario", "task"],
                    additionalProperties: false,
                  },
                },
                required: wantsModelSituation
                  ? ["title", "summary", "phases", "methodNotes", "modelSituation"]
                  : ["title", "summary", "phases", "methodNotes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_lesson" } },
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429)
        return new Response(
          JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to prosím za chvíli znovu." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (resp.status === 402)
        return new Response(
          JSON.stringify({ error: "Nedostatek kreditů pro AI generování. Kontaktujte administrátora." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const tc = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!tc) {
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const suggestion = JSON.parse(tc.function.arguments);
    return new Response(JSON.stringify({ suggestion }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("suggest-lesson-from-methods error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { requireAuth } from "../_shared/auth.ts";
import { AI_MODEL_QUALITY } from "../_shared/ai-models.ts";
import { buildSetPrompt, normalizeSetSteps, parseRequest, SET_TOOL } from "./prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const demoBlock = await demoAiGuard(auth, "generate-activity-from-text");
    if (demoBlock) return demoBlock;
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const parsedReq = parseRequest(await req.json().catch(() => null));
    if ("error" in parsedReq) {
      return new Response(JSON.stringify({ error: parsedReq.error }), {
        status: parsedReq.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const text = parsedReq.text;

    if (parsedReq.mode === "set") {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL_QUALITY,
          messages: [
            { role: "system", content: buildSetPrompt(parsedReq.types, parsedReq.count) },
            { role: "user", content: `Materiál:\n\n${text}` },
          ],
          tools: [SET_TOOL],
          tool_choice: { type: "function", function: { name: "create_activity_set" } },
        }),
      });
      if (!r.ok) {
        const t = await r.text();
        console.error("AI gateway error:", r.status, `body_len=${t.length}`);
        const msg = r.status === 429 ? "Příliš mnoho požadavků, zkuste to později."
          : r.status === 402 ? "Nedostatek kreditů pro AI generování." : "Chyba AI služby";
        return new Response(JSON.stringify({ error: msg }), {
          status: r.status === 429 || r.status === 402 || r.status === 403 ? r.status : 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const d = await r.json();
      let args: unknown = null;
      try { args = JSON.parse(d.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "null"); } catch { args = null; }
      const steps = normalizeSetSteps(args, parsedReq.types, parsedReq.count);
      if (steps.length === 0) {
        console.error("AI set: no valid steps");
        return new Response(JSON.stringify({ error: "AI nevrátila použitelné kroky, zkuste to znovu." }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ steps }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `Jsi zkušený český pedagog. Ze zadaného textu vytvoříš jednu kvalitní testovou otázku s výběrem odpovědí (kvíz) pro české školy.

PRAVIDLA:
- Vytvoř přesně 1 otázku, která ověřuje porozumění zadanému obsahu.
- Poskytni 4 možnosti odpovědí; přesně 1 je správná, ostatní věrohodné distraktory.
- Přidej krátké vysvětlení správné odpovědi (1–2 věty).
- Vše piš česky (cs-CZ).`;

    const userPrompt = `Vytvoř kvízovou otázku z tohoto obsahu:

${text}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL_QUALITY,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_quiz",
              description: "Vytvoří kvízovou otázku s odpověďmi.",
              parameters: {
                type: "object",
                additionalProperties: false,
                required: ["question", "answers", "explanation"],
                properties: {
                  question: { type: "string", description: "Text otázky" },
                  answers: {
                    type: "array",
                    description: "Možnosti odpovědí (přesně jedna má correct=true)",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      required: ["text", "correct"],
                      properties: {
                        text: { type: "string" },
                        correct: { type: "boolean" },
                      },
                    },
                  },
                  explanation: { type: "string", description: "Vysvětlení správné odpovědi" },
                },
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_quiz" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Příliš mnoho požadavků, zkuste to později." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Nedostatek kreditů pro AI generování." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, `body_len=${t.length}`);
      return new Response(JSON.stringify({ error: "Chyba AI služby" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response");
      return new Response(JSON.stringify({ error: "AI nevrátila strukturovaný výstup" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments) as {
      question?: string;
      answers?: Array<{ text?: string; correct?: boolean }>;
      explanation?: string;
    };

    const question = (parsed.question ?? "").trim();
    const answersRaw = Array.isArray(parsed.answers) ? parsed.answers : [];
    const answers = answersRaw
      .map((a) => ({
        text: typeof a.text === "string" ? a.text.trim() : "",
        correct: !!a.correct,
      }))
      .filter((a) => a.text.length > 0);

    // Guarantee exactly one correct answer.
    const correctCount = answers.filter((a) => a.correct).length;
    if (correctCount === 0 && answers.length > 0) answers[0].correct = true;
    if (correctCount > 1) {
      let seen = false;
      for (const a of answers) {
        if (a.correct && !seen) seen = true;
        else a.correct = false;
      }
    }

    if (!question || answers.length < 2) {
      return new Response(JSON.stringify({ error: "AI vrátila neúplnou otázku" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        activity: {
          activityType: "quiz",
          title: "Aktivita",
          quiz: {
            question,
            answers,
            explanation: (parsed.explanation ?? "").trim(),
          },
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("generate-activity-from-text error:", e instanceof Error ? e.name : "unknown");
    return new Response(
      JSON.stringify({ error: "Aktivitu se nepodařilo vytvořit." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

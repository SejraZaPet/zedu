import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { blocksToText, cleanLessonText, hasEnoughLessonText, INSUFFICIENT_LESSON_TEXT } from "../_shared/lesson-text.ts";
import { requireAuth } from "../_shared/auth.ts";
import { loadPracticeLesson, clampQuestionCount } from "../_shared/practice-lesson.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const demoBlock = await demoAiGuard(auth, "generate-practice");
    if (demoBlock) return demoBlock;
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { method_id, lesson_id, question_count } = await req.json().catch(() => ({}));
    if (!method_id || typeof method_id !== "string") {
      return json({ error: "method_id je povinné" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI gateway není nakonfigurován" }, 500);
    }
    const sb = createClient(supabaseUrl, serviceKey);

    // Method
    const { data: method, error: mErr } = await sb
      .from("study_methods")
      .select("id, name, slug, description, steps_json")
      .eq("id", method_id)
      .maybeSingle();
    if (mErr) return json({ error: mErr.message }, 500);
    if (!method) return json({ error: "Metoda nenalezena" }, 404);

    // Lesson content (try teacher_textbook_lessons, then global lessons)
    let lessonTitle = "";
    let lessonText = "";
    if (lesson_id) {
      const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth.authHeader } },
      });
      const found = await loadPracticeLesson(userClient, sb, lesson_id);
      if (found.ok) {
        lessonTitle = found.lesson.title;
        lessonText = blocksToText(found.lesson.blocks);
      } else {
        // Starší obecné lekce (tabulka lessons) – zachované chování.
        const { data: gLesson } = await sb
          .from("lessons")
          .select("title, content")
          .eq("id", lesson_id)
          .maybeSingle();
        if (gLesson) {
          lessonTitle = gLesson.title ?? "";
          lessonText = cleanLessonText((gLesson.content ?? "").toString());
        } else {
          return json({ error: found.error }, found.status);
        }
      }
    }

    if (lesson_id && !hasEnoughLessonText(lessonText)) {
      return json({ error: INSUFFICIENT_LESSON_TEXT }, 422);
    }

    if (lessonText.length > 8000) lessonText = lessonText.slice(0, 8000);

    const stepsSummary = Array.isArray(method.steps_json)
      ? (method.steps_json as any[])
          .map((s, i) => `${i + 1}. ${s.name}: ${s.description}`)
          .join("\n")
      : "";

    const systemPrompt = `Jsi pedagogický asistent. Tvoříš procvičovací cvičení pro žáky podle konkrétní studijní metody.
Vystupuj v češtině, oslovuj žáky neformálně (tykání). Cvičení musí přesně sledovat fáze metody.`;

    const userPrompt = `METODA: ${method.name}
POPIS METODY: ${method.description ?? ""}
FÁZE METODY:
${stepsSummary}

LEKCE: ${lessonTitle || "(bez konkrétní lekce – použij obecné téma metody)"}
OBSAH LEKCE:
${lessonText || "(žádný obsah – vytvoř obecné cvičení o studijní metodě)"}

Vytvoř pro každou fázi metody 2–3 otázky, které žáka touto fází provedou.
- Pro fáze typu "co už vím" / brainstorming volej typ "open" (otevřená odpověď, correct_answer prázdné).
- Pro fáze ověření znalostí volej typ "multiple_choice" se 4 možnostmi a indexem správné odpovědi.
- Pro fáze pojmů volej typ "short_answer" s krátkou očekávanou odpovědí.
${question_count ? `Celkem vytvoř přibližně ${clampQuestionCount(question_count, 8)} otázek (rozděl je mezi fáze).\n` : ""}Vrať strukturovaný JSON přes nástroj generate_practice_set.`;

    const aiBody = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "generate_practice_set",
            description: "Vrátí sadu otázek seskupených po fázích metody.",
            parameters: {
              type: "object",
              properties: {
                method_name: { type: "string" },
                lesson_title: { type: "string" },
                phases: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      phase_name: { type: "string" },
                      phase_intro: { type: "string" },
                      questions: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            type: {
                              type: "string",
                              enum: ["open", "short_answer", "multiple_choice"],
                            },
                            prompt: { type: "string" },
                            options: {
                              type: "array",
                              items: { type: "string" },
                            },
                            correct_index: { type: "number" },
                            correct_answer: { type: "string" },
                            hint: { type: "string" },
                          },
                          required: ["type", "prompt"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["phase_name", "questions"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["method_name", "phases"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: {
        type: "function",
        function: { name: "generate_practice_set" },
      },
    };

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(aiBody),
      },
    );

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return json(
          { error: "Překročili jsme limit požadavků na AI. Zkus to znovu za chvíli." },
          429,
        );
      }
      if (aiResp.status === 402) {
        return json(
          { error: "Došly kredity Lovable AI. Doplň je v nastavení workspace." },
          402,
        );
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return json({ error: "Chyba AI brány" }, 500);
    }

    const aiData = await aiResp.json();
    const toolCall =
      aiData?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!toolCall) {
      console.error("No tool call in AI response", JSON.stringify(aiData));
      return json({ error: "AI nevrátila strukturovaná data" }, 500);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall);
    } catch (e) {
      return json({ error: "Nepodařilo se přečíst odpověď AI" }, 500);
    }

    return json({
      method: { id: method.id, name: method.name, slug: method.slug },
      lesson: lesson_id ? { id: lesson_id, title: lessonTitle } : null,
      practice: parsed,
    });
  } catch (e) {
    console.error("generate-practice error:", e);
    return json(
      { error: e instanceof Error ? e.message : "Neznámá chyba" },
      500,
    );
  }
});

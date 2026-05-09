import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

// Extract plain text from a lesson's blocks JSON or content field.
function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  const walk = (node: any) => {
    if (!node) return;
    if (typeof node === "string") {
      out.push(node);
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node === "object") {
      if (typeof node.text === "string") out.push(node.text);
      if (typeof node.content === "string") out.push(node.content);
      if (typeof node.title === "string") out.push(node.title);
      if (typeof node.heading === "string") out.push(node.heading);
      if (Array.isArray(node.children)) walk(node.children);
      if (Array.isArray(node.blocks)) walk(node.blocks);
      if (Array.isArray(node.items)) walk(node.items);
      if (node.data && typeof node.data === "object") walk(node.data);
    }
  };
  walk(blocks);
  return out.join("\n").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { method_id, lesson_id } = await req.json().catch(() => ({}));
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
      const { data: tLesson } = await sb
        .from("teacher_textbook_lessons")
        .select("title, blocks")
        .eq("id", lesson_id)
        .maybeSingle();
      if (tLesson) {
        lessonTitle = tLesson.title ?? "";
        lessonText = blocksToText(tLesson.blocks);
      } else {
        const { data: gLesson } = await sb
          .from("lessons")
          .select("title, content")
          .eq("id", lesson_id)
          .maybeSingle();
        if (gLesson) {
          lessonTitle = gLesson.title ?? "";
          lessonText = (gLesson.content ?? "").toString();
        }
      }
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
Vrať strukturovaný JSON přes nástroj generate_practice_set.`;

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

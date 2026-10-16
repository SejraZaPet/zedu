import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { requireAuth } from "../_shared/auth.ts";
import { loadPracticeLesson } from "../_shared/practice-lesson.ts";

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

const MAX_CARDS = 15;
const SUMMARY_BULLETS = 5;
const LESSON_TEXT_MAX = 6000;

function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  // deno-lint-ignore no-explicit-any
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
      if (Array.isArray(node.items)) walk(node.items);
    }
  };
  walk(blocks);
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > LESSON_TEXT_MAX ? text.slice(0, LESSON_TEXT_MAX) : text;
}

Deno.serve(async (req) => {
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
    const demoBlock = await demoAiGuard(auth, "lesson-study-helper");
    if (demoBlock) return demoBlock;
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { lesson_id, mode } = await req.json().catch(() => ({}));
    if (!lesson_id || typeof lesson_id !== "string") {
      return json({ error: "lesson_id je povinné" }, 400);
    }
    if (mode !== "cards" && mode !== "summary") {
      return json({ error: "mode musí být cards nebo summary" }, 400);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return json({ error: "AI brána není nakonfigurována" }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth.authHeader } },
    });

    // Přístup k lekci ověřuje RLS klienta volajícího (stejně jako procvičování).
    const found = await loadPracticeLesson(userClient, sb, lesson_id);
    if (!found.ok) return json({ error: found.error }, found.status);

    const lessonText = blocksToText(found.lesson.blocks);
    if (!lessonText) {
      return json({ error: "Lekce zatím nemá žádný textový obsah." }, 400);
    }

    const systemPrompt =
      "Jsi pedagogický asistent pro české žáky. Odpovídáš česky, tykáš, jsi stručný a věcný. Vycházíš výhradně z dodaného obsahu lekce, nic si nevymýšlíš.";

    const userPrompt =
      mode === "cards"
        ? `LEKCE: ${found.lesson.title}\nOBSAH LEKCE:\n${lessonText}\n\nVytvoř z obsahu lekce nejvýše ${MAX_CARDS} otáčecích kartiček na opakování. Každá kartička má přední stranu (pojem nebo otázka) a zadní stranu (krátká odpověď nebo definice, max. 2 věty). Vrať JSON přes nástroj study_helper.`
        : `LEKCE: ${found.lesson.title}\nOBSAH LEKCE:\n${lessonText}\n\nShrň obsah lekce do přesně ${SUMMARY_BULLETS} stručných odrážek (každá max. 2 věty), aby si žák rychle zopakoval to nejdůležitější. Vrať JSON přes nástroj study_helper.`;

    const schema =
      mode === "cards"
        ? {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  front: { type: "string" },
                  back: { type: "string" },
                },
                required: ["front", "back"],
                additionalProperties: false,
              },
            },
          }
        : {
            bullets: {
              type: "array",
              items: { type: "string" },
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
                name: "study_helper",
                description: "Vrátí kartičky nebo shrnutí lekce.",
                parameters: {
                  type: "object",
                  properties: schema,
                  required: [mode === "cards" ? "cards" : "bullets"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: { type: "function", function: { name: "study_helper" } },
        }),
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
          { error: "Došly kredity pro AI. Kontaktuj prosím učitele." },
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

    // deno-lint-ignore no-explicit-any
    let parsed: any;
    try {
      parsed = JSON.parse(toolCall);
    } catch {
      return json({ error: "Nepodařilo se přečíst odpověď AI" }, 500);
    }

    if (mode === "cards") {
      const cards = (Array.isArray(parsed?.cards) ? parsed.cards : [])
        // deno-lint-ignore no-explicit-any
        .map((c: any) => ({
          front: (c?.front ?? "").toString().trim(),
          back: (c?.back ?? "").toString().trim(),
        }))
        .filter((c: { front: string; back: string }) => c.front && c.back)
        .slice(0, MAX_CARDS);
      if (cards.length === 0) {
        return json({ error: "Z této lekce se kartičky vytvořit nepodařily." }, 422);
      }
      return json({ mode, lesson: { id: lesson_id, title: found.lesson.title }, cards });
    }

    const bullets = (Array.isArray(parsed?.bullets) ? parsed.bullets : [])
      .map((b: unknown) => (b ?? "").toString().trim())
      .filter(Boolean)
      .slice(0, SUMMARY_BULLETS);
    if (bullets.length === 0) {
      return json({ error: "Shrnutí se vytvořit nepodařilo." }, 422);
    }
    return json({ mode, lesson: { id: lesson_id, title: found.lesson.title }, bullets });
  } catch (e) {
    console.error("lesson-study-helper error:", e);
    return json({ error: e instanceof Error ? e.message : "Neznámá chyba" }, 500);
  }
});

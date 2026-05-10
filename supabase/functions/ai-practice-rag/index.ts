import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

type Block = {
  type?: string;
  text?: string;
  content?: string;
  title?: string;
  items?: unknown[];
  [k: string]: unknown;
};

function blocksToText(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  const out: string[] = [];
  for (const b of blocks as Block[]) {
    if (!b) continue;
    if (typeof b.title === "string") out.push(`## ${b.title}`);
    if (typeof b.text === "string") out.push(b.text);
    if (typeof b.content === "string") out.push(b.content);
    if (Array.isArray(b.items)) {
      for (const it of b.items) {
        if (typeof it === "string") out.push(`- ${it}`);
        else if (it && typeof it === "object" && "text" in (it as any)) {
          out.push(`- ${(it as any).text}`);
        }
      }
    }
  }
  return out.join("\n").slice(0, 8000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { lesson_id, student_id, method } = await req.json();
    if (!lesson_id) {
      return new Response(JSON.stringify({ error: "lesson_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch lesson content
    const { data: lesson, error: lessonErr } = await supabase
      .from("textbook_lessons")
      .select("id, title, blocks")
      .eq("id", lesson_id)
      .maybeSingle();

    if (lessonErr || !lesson) {
      return new Response(JSON.stringify({ error: "Lesson not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lessonText = blocksToText(lesson.blocks);

    // Adapt difficulty: combine XP level + recent success rate
    let targetDifficulty: "easy" | "medium" | "hard" = "medium";
    if (student_id) {
      const [{ data: xp }, { data: recent }] = await Promise.all([
        supabase
          .from("student_xp")
          .select("level")
          .eq("student_id", student_id)
          .maybeSingle(),
        supabase
          .from("student_practice_sessions")
          .select("score, answers_json")
          .eq("student_id", student_id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const level = xp?.level ?? 1;
      let avgPercent = 50;
      if (recent && recent.length > 0) {
        const percents = recent
          .map((r: any) => {
            const p = r.answers_json?.percent;
            return typeof p === "number" ? p : null;
          })
          .filter((x): x is number => x !== null);
        if (percents.length > 0) {
          avgPercent = percents.reduce((a, b) => a + b, 0) / percents.length;
        }
      }

      // Combine: high level + high success → hard; low both → easy
      const score = level * 10 + avgPercent;
      if (score < 60) targetDifficulty = "easy";
      else if (score > 110) targetDifficulty = "hard";
      else targetDifficulty = "medium";
    }

    const prompt = `Jsi učitel připravující procvičovací otázky pro českého žáka.
Tvým úkolem je vygenerovat 6 otázek STRIKTNĚ z následujícího obsahu lekce – nepoužívej žádné obecné znalosti mimo tento text.

LEKCE: ${lesson.title}
${method ? `METODA: ${method}` : ""}
CÍLOVÁ OBTÍŽNOST: ${targetDifficulty} (easy=základní fakta, medium=porozumění, hard=aplikace/analýza)

OBSAH LEKCE:
"""
${lessonText}
"""

Vrať JSON ve formátu:
{
  "questions": [
    { "type": "multiple_choice", "text": "...", "options": ["A","B","C","D"], "correct_index": 0, "difficulty": "easy|medium|hard", "topic": "krátké téma" },
    { "type": "true_false", "text": "...", "correct_answer": true, "difficulty": "easy", "topic": "..." }
  ],
  "recommendation": "Krátké česky psané doporučení co opakovat (1-2 věty)."
}

Mix obtížností kolem cílové úrovně. Zhruba 4 multiple_choice + 2 true_false. Otázky musí být zodpověditelné výhradně z výše uvedeného textu.`;

    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content:
                "Jsi pedagogický asistent. Generuješ otázky pouze z poskytnutého textu lekce.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (aiRes.status === 429) {
      return new Response(
        JSON.stringify({ error: "Rate limit. Zkus to za chvíli." }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (aiRes.status === 402) {
      return new Response(
        JSON.stringify({ error: "Vyčerpané kredity Lovable AI." }),
        {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("AI gateway error", aiRes.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const text = aiJson.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { questions: [], recommendation: "" };
    }

    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];
    const recommendation: string = parsed.recommendation ?? "";

    // Persist recommendation (best-effort)
    if (student_id) {
      await supabase.from("student_practice_recommendations").insert({
        student_id,
        lesson_id,
        weak_topics: [],
        recommendation,
      });
    }

    return new Response(
      JSON.stringify({
        lesson: { id: lesson.id, title: lesson.title },
        target_difficulty: targetDifficulty,
        questions,
        recommendation,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("ai-practice-rag error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

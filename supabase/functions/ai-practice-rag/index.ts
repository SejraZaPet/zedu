import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { blocksToText, hasEnoughLessonText, INSUFFICIENT_LESSON_TEXT } from "../_shared/lesson-text.ts";
import { requireAuth, hasRole } from "../_shared/auth.ts";
import { loadPracticeLesson, clampQuestionCount } from "../_shared/practice-lesson.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const auth = await requireAuth(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  {
    const { demoAiGuard } = await import("../_shared/demo-ai-guard.ts");
    const demoBlock = await demoAiGuard(auth, "ai-practice-rag");
    if (demoBlock) return demoBlock;
  }

  try {
    const { lesson_id, student_id, method, question_count } = await req.json();
    const total = clampQuestionCount(question_count, 6);
    const tfCount = Math.max(1, Math.round(total / 3));
    const mcCount = total - tfCount;
    if (!lesson_id) {
      return new Response(JSON.stringify({ error: "lesson_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authorization: caller can only request practice for themselves,
    // unless they're a teacher/admin.
    let effectiveStudentId: string | null = student_id ?? null;
    if (effectiveStudentId && effectiveStudentId !== auth.userId) {
      const [isTeacher, isAdmin] = await Promise.all([
        hasRole(auth.userId, "teacher"),
        hasRole(auth.userId, "admin"),
      ]);
      if (!isTeacher && !isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
    // If no student_id provided, default to the caller.
    if (!effectiveStudentId) effectiveStudentId = auth.userId;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);


    // Lekce: nejdřív globální, pak učitelská; přístup ověřen RLS volajícího.
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth.authHeader } },
    });
    const found = await loadPracticeLesson(userClient, supabase, lesson_id);
    if (!found.ok) {
      return new Response(JSON.stringify({ error: found.error }), {
        status: found.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const lesson = found.lesson;

    const lessonText = blocksToText(lesson.blocks);
    if (!hasEnoughLessonText(lessonText)) {
      return new Response(JSON.stringify({ error: INSUFFICIENT_LESSON_TEXT }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Adapt difficulty: combine XP level + recent success rate
    let targetDifficulty: "easy" | "medium" | "hard" = "medium";
    if (effectiveStudentId) {
      const [{ data: xp }, { data: recent }] = await Promise.all([
        supabase
          .from("student_xp")
          .select("level")
          .eq("student_id", effectiveStudentId)
          .maybeSingle(),
        supabase
          .from("student_practice_sessions")
          .select("score, answers_json")
          .eq("student_id", effectiveStudentId)
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
Tvým úkolem je vygenerovat ${total} otázek STRIKTNĚ z následujícího obsahu lekce – nepoužívej žádné obecné znalosti mimo tento text.

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

Mix obtížností kolem cílové úrovně. Zhruba ${mcCount} multiple_choice + ${tfCount} true_false. Otázky musí být zodpověditelné výhradně z výše uvedeného textu.`;

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
    if (effectiveStudentId) {
      await supabase.from("student_practice_recommendations").insert({
        student_id: effectiveStudentId,
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

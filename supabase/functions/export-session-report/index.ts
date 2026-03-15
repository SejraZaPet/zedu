import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { sessionId, anonymizationMode = "pseudonymous", includeAnswerKey = true } = await req.json();
    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Missing sessionId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch session
    const { data: session, error: sessErr } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("teacher_id", user.id)
      .single();

    if (sessErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch players + responses
    const { data: players } = await supabase
      .from("game_players")
      .select("id, nickname, user_id, total_score")
      .eq("session_id", sessionId);

    const { data: responses } = await supabase
      .from("game_responses")
      .select("*")
      .eq("session_id", sessionId)
      .order("question_index", { ascending: true });

    // For named mode
    let profileMap: Record<string, string> = {};
    if (anonymizationMode === "named" && players?.length) {
      const userIds = players.filter((p) => p.user_id).map((p) => p.user_id!);
      if (userIds.length > 0) {
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const adminClient = createClient(supabaseUrl, serviceKey);
        const { data: profiles } = await adminClient
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap[p.id] = `${p.first_name} ${p.last_name}`.trim();
          }
        }
      }
    }

    const slides = (session.activity_data as any[]) || [];
    const totalPlayers = players?.length || 0;
    const totalResponses = responses?.length || 0;

    // Compute per-slide stats
    const slideStats = slides.map((slide: any, i: number) => {
      const slideResponses = responses?.filter((r) => r.question_index === i) || [];
      const correctCount = slideResponses.filter((r) => r.is_correct).length;
      const totalAnswered = slideResponses.length;
      const avgTime = totalAnswered > 0
        ? Math.round(slideResponses.reduce((s, r) => s + r.response_time_ms, 0) / totalAnswered)
        : 0;
      const successRate = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

      // Find most common wrong answers
      const wrongAnswers = slideResponses.filter((r) => !r.is_correct);
      const answerCounts: Record<string, number> = {};
      wrongAnswers.forEach((r) => {
        const key = JSON.stringify(r.answer);
        answerCounts[key] = (answerCounts[key] || 0) + 1;
      });
      const commonMistakes = Object.entries(answerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([answer, count]) => ({ answer: JSON.parse(answer), count }));

      return {
        index: i + 1,
        type: slide.type,
        headline: slide.projector?.headline || `Slide ${i + 1}`,
        totalAnswered,
        correctCount,
        successRate,
        avgTimeMs: avgTime,
        commonMistakes,
      };
    });

    // Class-level stats
    const allScores = (players || []).map((p) => p.total_score);
    const classStats = {
      mean: allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : 0,
      median: allScores.length > 0 ? allScores.sort((a, b) => a - b)[Math.floor(allScores.length / 2)] : 0,
      min: allScores.length > 0 ? Math.min(...allScores) : 0,
      max: allScores.length > 0 ? Math.max(...allScores) : 0,
    };

    // Generate AI recommendations
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let recommendations: string[] = [];

    if (LOVABLE_API_KEY) {
      const weakSlides = slideStats.filter((s) => s.successRate < 60);
      const summaryForAI = `Session: ${session.title}
Počet žáků: ${totalPlayers}
Průměrné skóre třídy: ${classStats.mean}
Problematické slidy (úspěšnost < 60%):
${weakSlides.map((s) => `- Slide ${s.index} "${s.headline}" (${s.successRate}%): nejčastější chyby: ${s.commonMistakes.map((m) => JSON.stringify(m.answer)).join(", ")}`).join("\n")}`;

      try {
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: "Jsi zkušený český pedagog. Na základě výsledků live session napiš 3–5 stručných doporučení pro učitele (každé max 1 věta, česky). Zaměř se na konkrétní slabá místa a jak je zlepšit.",
              },
              { role: "user", content: summaryForAI },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "provide_recommendations",
                  description: "Poskytne doporučení pro učitele.",
                  parameters: {
                    type: "object",
                    properties: {
                      recommendations: {
                        type: "array",
                        items: { type: "string" },
                        minItems: 3,
                        maxItems: 5,
                      },
                    },
                    required: ["recommendations"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: { type: "function", function: { name: "provide_recommendations" } },
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
          if (toolCall) {
            const parsed = JSON.parse(toolCall.function.arguments);
            recommendations = parsed.recommendations || [];
          }
        }
      } catch (aiErr) {
        console.error("AI recommendations error:", aiErr);
        recommendations = ["Automatická doporučení nebyla k dispozici."];
      }
    }

    // Build the report JSON (frontend will render as PDF-like view or use jsPDF)
    const report = {
      sessionOverview: {
        title: session.title,
        date: session.created_at,
        totalSlides: slides.length,
        totalParticipants: totalPlayers,
        totalResponses,
        averageScore: classStats.mean,
      },
      participationSummary: {
        maxPossibleResponses: slides.length * totalPlayers,
        actualResponses: totalResponses,
        participationRate: slides.length * totalPlayers > 0
          ? Math.round((totalResponses / (slides.length * totalPlayers)) * 100)
          : 0,
      },
      perSlideResults: slideStats,
      classStatistics: classStats,
      commonMistakes: slideStats
        .filter((s) => s.commonMistakes.length > 0)
        .map((s) => ({
          slide: s.index,
          headline: s.headline,
          successRate: s.successRate,
          mistakes: s.commonMistakes,
        })),
      recommendations,
      ...(includeAnswerKey
        ? {
            answerKey: slides.map((slide: any, i: number) => {
              const spec = slide.activitySpec;
              let correctAnswer = "";
              if (spec?.type === "mcq" && spec.model?.choices) {
                correctAnswer = spec.model.choices[spec.model.correctIndex] || "";
              } else if (spec?.type === "matching" && spec.model?.pairs) {
                correctAnswer = spec.model.pairs.map((p: any) => `${p.left} → ${p.right}`).join("; ");
              }
              return {
                slide: i + 1,
                headline: slide.projector?.headline || "",
                correctAnswer: correctAnswer || "(bez aktivity)",
              };
            }),
          }
        : {}),
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("export-session-report error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

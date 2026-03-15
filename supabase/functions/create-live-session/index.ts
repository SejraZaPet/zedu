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

    const { lessonPlanId, title, slides } = await req.json();
    if (!slides || !Array.isArray(slides) || slides.length === 0) {
      return new Response(JSON.stringify({ error: "Missing slides data" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to generate game code
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRole);

    // Generate game code
    const { data: codeData, error: codeError } = await adminClient.rpc("generate_game_code");
    if (codeError) throw codeError;

    const gameCode = codeData as string;

    // Convert slides to activity_data format compatible with game_sessions
    // Each slide becomes a "question" in the game
    const activityData = slides.map((slide: any, i: number) => ({
      slideId: slide.slideId || `slide-${i + 1}`,
      type: slide.type,
      projector: slide.projector,
      device: slide.device,
      teacherNotes: slide.teacherNotes || "",
      activitySpec: slide.activitySpec || null,
    }));

    // Create game session with lesson_plan type
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        teacher_id: user.id,
        game_code: gameCode,
        title: title || "Live výuka",
        status: "lobby",
        current_question_index: -1,
        activity_data: activityData,
        settings: {
          sessionType: "lesson_plan",
          lessonPlanId: lessonPlanId || null,
          timePerQuestion: 0, // teacher-paced, no auto timer
          revealAnswer: false,
        },
      })
      .select("id, game_code")
      .single();

    if (sessionError) throw sessionError;

    const joinUrl = `/live/pripojit?code=${gameCode}`;

    return new Response(
      JSON.stringify({
        sessionId: session.id,
        gameCode: session.game_code,
        joinUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("create-live-session error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

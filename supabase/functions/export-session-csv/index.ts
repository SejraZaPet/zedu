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

    // Fetch session (verify ownership)
    const { data: session, error: sessErr } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("teacher_id", user.id)
      .single();

    if (sessErr || !session) {
      return new Response(JSON.stringify({ error: "Session not found or not owned" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch players
    const { data: players } = await supabase
      .from("game_players")
      .select("id, nickname, user_id")
      .eq("session_id", sessionId);

    // Fetch responses
    const { data: responses } = await supabase
      .from("game_responses")
      .select("*")
      .eq("session_id", sessionId)
      .order("question_index", { ascending: true });

    // For named mode, fetch profiles
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

    // Build student identifier map
    const playerIdentifiers: Record<string, string> = {};
    if (players) {
      players.forEach((p, i) => {
        if (anonymizationMode === "named") {
          playerIdentifiers[p.id] = p.user_id && profileMap[p.user_id]
            ? profileMap[p.user_id]
            : p.nickname;
        } else if (anonymizationMode === "pseudonymous") {
          playerIdentifiers[p.id] = `Student_${i + 1}`;
        }
        // anonymous: no identifier
      });
    }

    const slides = (session.activity_data as any[]) || [];

    // Build CSV rows
    const separator = ";";
    const columns = [
      "session_id",
      "slide_index",
      "slide_type",
      ...(anonymizationMode !== "anonymous" ? ["student_identifier"] : []),
      "activity_type",
      "answer_raw",
      "is_correct",
      "score",
      "max_score",
      "response_time_ms",
      "timestamp",
    ];

    let csvRows = [columns.join(separator)];

    if (responses) {
      for (const r of responses) {
        const slide = slides[r.question_index];
        const row = [
          sessionId,
          String(r.question_index + 1),
          slide?.type || "",
          ...(anonymizationMode !== "anonymous" ? [playerIdentifiers[r.player_id] || ""] : []),
          slide?.activitySpec?.type || slide?.type || "",
          JSON.stringify(r.answer).replace(/;/g, ","),
          r.is_correct ? "1" : "0",
          String(r.score),
          "100", // max_score placeholder
          String(r.response_time_ms),
          r.created_at,
        ];
        csvRows.push(row.join(separator));
      }
    }

    // Add answer key at the end if requested
    if (includeAnswerKey) {
      csvRows.push("");
      csvRows.push("# KLÍČ ODPOVĚDÍ");
      slides.forEach((slide, i) => {
        if (slide.activitySpec) {
          const spec = slide.activitySpec;
          let answer = "";
          if (spec.type === "mcq" && spec.model?.choices) {
            answer = spec.model.choices[spec.model.correctIndex] || "";
          } else if (spec.type === "matching" && spec.model?.pairs) {
            answer = spec.model.pairs.map((p: any) => `${p.left}→${p.right}`).join(", ");
          }
          csvRows.push(`# Slide ${i + 1}: ${slide.projector?.headline || ""} → ${answer}`);
        }
      });
    }

    // UTF-8 BOM for Excel
    const BOM = "\uFEFF";
    const csvContent = BOM + csvRows.join("\n");

    const date = new Date().toISOString().slice(0, 10);
    const filename = `${(session.title || "session").replace(/\s+/g, "_")}_${date}_${anonymizationMode}.csv`;

    return new Response(csvContent, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("export-session-csv error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

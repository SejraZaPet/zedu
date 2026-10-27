import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { excludePreviewIds, loadPreviewStudents } from "../_shared/preview-students.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { classSuccessSummary, computeParticipantStats } from "../_shared/session-participants.ts";
import { sessionDisplayName } from "../_shared/session-display-name.ts";

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
    const { data: rawPlayers } = await supabase
      .from("game_players")
      .select("id, nickname, user_id, total_score")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });
    // Testovací žák: jen ve hrách jeho vlastníka.
    const previewMap = await loadPreviewStudents(
      createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!),
    );
    const players = rawPlayers
      ? excludePreviewIds(rawPlayers, (p) => p.user_id, previewMap, user.id)
      : rawPlayers;
    const playerIdSet = new Set((players ?? []).map((p) => p.id));

    // Fetch responses
    const { data: rawResponses } = await supabase
      .from("game_responses")
      .select("*")
      .eq("session_id", sessionId)
      .order("question_index", { ascending: true });
    const responses = rawResponses
      ? rawResponses.filter((r: any) => !r.player_id || playerIdSet.has(r.player_id))
      : rawResponses;

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
        if (anonymizationMode !== "anonymous") playerIdentifiers[p.id] = sessionDisplayName(p, i, anonymizationMode, profileMap);
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

    // Participant summary: success % and correct out of graded
    const stats = computeParticipantStats(slides, players || [], (responses || []) as any);
    csvRows.push("");
    csvRows.push("# ÚČASTNÍCI");
    csvRows.push(["participant", "success_pct", "correct_of_total", "correct", "graded", "score", "avg_response_time_ms"].join(separator));
    stats.forEach((st, i) => {
      csvRows.push([
        anonymizationMode === "anonymous" ? `Účastník ${i + 1}` : (playerIdentifiers[st.playerId] || ""),
        st.successRate === null ? "–" : String(st.successRate),
        st.graded ? `${st.correct} z ${st.graded}` : "–",
        String(st.correct), String(st.graded), String(st.score),
        st.avgTimeMs === null ? "" : String(st.avgTimeMs),
      ].join(separator));
    });
    const sum = classSuccessSummary(stats);
    csvRows.push(`# Průměrná úspěšnost třídy: ${sum.averageSuccessRate === null ? "–" : sum.averageSuccessRate + " %"}; pod 50 %: ${sum.needHelpCount}`);

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

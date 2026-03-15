import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── SlideSpec → HTML renderer ──────────────────────────────
function renderSlideToHtml(slide: any, index: number, options: any): string {
  const typeLabels: Record<string, string> = {
    intro: "Úvod", objective: "Cíl", explain: "Výklad",
    practice: "Procvičení", activity: "Aktivita", summary: "Shrnutí", exit: "Exit ticket",
  };
  const typeColors: Record<string, string> = {
    intro: "#3b82f6", objective: "#8b5cf6", explain: "#f59e0b",
    practice: "#22c55e", activity: "#f43f5e", summary: "#14b8a6", exit: "#f97316",
  };

  const isStudentPaced = options.mode === "student_paced";
  const isStudent = options.exportTarget === "student";

  // Student-paced: use device content as primary
  const headline = isStudentPaced
    ? (slide.device?.headline || slide.projector?.headline || "")
    : (slide.projector?.headline || "");
  const body = isStudentPaced
    ? (slide.device?.instructions || slide.projector?.body || "")
    : (slide.projector?.body || "");
  const deviceInstructions = slide.device?.instructions || "";
  const notes = slide.teacherNotes || "";
  const typeColor = typeColors[slide.type] || "#6b7280";
  const typeLabel = typeLabels[slide.type] || slide.type;

  // Activity rendering — per-type transform rules
  let activityHtml = "";
  if (slide.activitySpec) {
    const spec = slide.activitySpec;
    const aType = spec.type || "unknown";

    if (aType === "mcq" && spec.model?.choices) {
      activityHtml = `<div class="activity-box">
        <h4>📝 ${spec.prompt || ""}</h4>
        <ul>${spec.model.choices.map((c: string, i: number) =>
          `<li${i === spec.model.correctIndex && options.includeAnswerKey ? ' class="correct"' : ""}>${c}</li>`
        ).join("")}</ul>
      </div>`;
    } else if (aType === "matching" && spec.model?.pairs) {
      activityHtml = `<div class="activity-box">
        <h4>🔗 ${spec.prompt || "Spojování"}</h4>
        <table class="matching"><tbody>
          ${spec.model.pairs.map((p: any) => `<tr><td>${p.left}</td><td>→</td><td>${isStudent ? "___________" : p.right}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
    } else if (aType === "hotspot") {
      // Hotspot: fallback text description for print
      const areas = (!isStudent && options.includeAnswerKey && spec.model?.correctAreas)
        ? `<ul>${spec.model.correctAreas.map((a: any) => `<li>${a.label || a.description || "oblast"}</li>`).join("")}</ul>`
        : `<p>Označte správné oblasti na obrázku (v aplikaci ZEdu).</p>`;
      activityHtml = `<div class="activity-box">
        <h4>📍 ${spec.prompt || "Hotspot"}</h4>
        ${spec.model?.imageUrl ? `<img src="${spec.model.imageUrl}" alt="Hotspot obrázek" style="max-width:100%;border-radius:8px;margin:8px 0">` : ""}
        ${areas}
      </div>`;
    } else if (aType === "video") {
      // Video: checkpoints as text questions
      let checkpointsHtml = "";
      if (spec.model?.checkpoints) {
        checkpointsHtml = `<ol>${spec.model.checkpoints.map((cp: any) =>
          `<li><strong>[${cp.time || ""}]</strong> ${cp.question || ""}${!isStudent && options.includeAnswerKey && cp.answer ? ` <em class="correct">(${cp.answer})</em>` : ""}</li>`
        ).join("")}</ol>`;
      }
      activityHtml = `<div class="activity-box">
        <h4>🎬 ${spec.prompt || "Video"}</h4>
        <p>${spec.model?.videoUrl ? `URL: ${spec.model.videoUrl}` : "Přehrajte video v aplikaci."}</p>
        ${checkpointsHtml ? `<h5>Kontrolní otázky:</h5>${checkpointsHtml}` : ""}
      </div>`;
    } else if (aType === "true_false") {
      const showAnswer = !isStudent && options.includeAnswerKey;
      activityHtml = `<div class="activity-box">
        <h4>✅ ${spec.prompt || "Pravda / Nepravda"}</h4>
        <p>○ Pravda ${showAnswer && spec.model?.correctAnswer === true ? '<span class="correct">✓</span>' : ""}
           ○ Nepravda ${showAnswer && spec.model?.correctAnswer === false ? '<span class="correct">✓</span>' : ""}</p>
      </div>`;
    } else if (aType === "ordering" && spec.model?.items) {
      const items = isStudent ? spec.model.items : (spec.model.correctOrder || spec.model.items);
      activityHtml = `<div class="activity-box">
        <h4>🔢 ${spec.prompt || "Seřaďte"}</h4>
        <ol>${items.map((item: string, i: number) => `<li>${isStudent ? `☐ ${item}` : `${item}`}</li>`).join("")}</ol>
      </div>`;
    } else if (aType === "fill_blank") {
      const showAnswers = !isStudent && options.includeAnswerKey;
      activityHtml = `<div class="activity-box">
        <h4>✏️ ${spec.prompt || "Doplňte"}</h4>
        <p>${spec.model?.text || "Doplňte chybějící slova."}</p>
        ${showAnswers && spec.model?.answers ? `<p class="correct"><strong>Odpovědi:</strong> ${spec.model.answers.join(", ")}</p>` : ""}
      </div>`;
    } else {
      // Generic fallback
      activityHtml = `<div class="activity-box activity-placeholder">
        <h4>🎯 Aktivita: ${aType.toUpperCase()}</h4>
        <p>${isStudent ? "Vypracuj v aplikaci ZEdu." : (spec.prompt || "")}</p>
      </div>`;
    }
  }

  // QR code placeholder
  const qrHtml = options.includeQrCodes && slide.type === "intro"
    ? `<div class="qr-placeholder"><div class="qr-box">QR</div><p>Připojte se na: <strong>${options.joinCode || "______"}</strong></p></div>`
    : "";

  // Device section — only for teacher in live mode
  const deviceHtml = (!isStudentPaced && !isStudent && deviceInstructions)
    ? `<div class="device-section"><h4>📱 Zařízení žáka</h4><p>${deviceInstructions}</p></div>`
    : "";

  // Teacher notes — never in student export
  const notesHtml = options.includeTeacherNotes && !isStudent && notes
    ? `<div class="teacher-notes"><strong>📋 Poznámky:</strong> ${notes}</div>`
    : "";

  return `<section class="slide" data-slide="${index + 1}" role="region" aria-label="Slide ${index + 1}: ${headline}">
    <div class="slide-header">
      <span class="slide-badge" style="background:${typeColor}">${typeLabel}</span>
      <span class="slide-number">${index + 1}</span>
    </div>
    <div class="slide-content">
      <h2>${headline}</h2>
      <p class="body-text">${body}</p>
      ${qrHtml}
      ${activityHtml}
      ${deviceHtml}
    </div>
    ${notesHtml}
  </section>`;
}

function generateFullHtml(slides: any[], title: string, options: any): string {
  const isStudent = options.exportTarget === "student";
  const subtitle = isStudent ? "Žákovský handout" : "Učitelský export";
  const slidesHtml = slides.map((s, i) => renderSlideToHtml(s, i, options)).join("\n");

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} – ${subtitle}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; }
  .header { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 24px 40px; }
  .header h1 { font-size: 24px; }
  .header p { color: #64748b; font-size: 14px; }
  .slides { max-width: 900px; margin: 32px auto; padding: 0 20px; }
  .slide { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; margin-bottom: 24px; break-inside: avoid; }
  .slide-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .slide-badge { color: #fff; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .slide-number { color: #94a3b8; font-size: 14px; font-weight: 600; }
  .slide-content h2 { font-size: 22px; margin-bottom: 12px; }
  .body-text { color: #475569; line-height: 1.6; white-space: pre-wrap; }
  .device-section { margin-top: 20px; padding: 16px; background: #f1f5f9; border-radius: 8px; }
  .device-section h4 { font-size: 13px; color: #64748b; margin-bottom: 8px; }
  .device-section p { font-size: 14px; }
  .teacher-notes { margin-top: 16px; padding: 12px 16px; border: 1px dashed #cbd5e1; border-radius: 8px; font-size: 13px; color: #64748b; }
  .activity-box { margin-top: 16px; padding: 16px; border: 2px solid #e2e8f0; border-radius: 8px; background: #fefce8; }
  .activity-box h4 { font-size: 14px; margin-bottom: 8px; }
  .activity-box ul { list-style: none; padding: 0; }
  .activity-box li { padding: 6px 12px; margin: 4px 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; }
  .activity-box li.correct { border-color: #22c55e; background: #f0fdf4; font-weight: 600; }
  .activity-placeholder { text-align: center; background: #fef9c3; border-color: #eab308; }
  .matching td { padding: 4px 12px; font-size: 14px; }
  .qr-placeholder { text-align: center; margin: 20px 0; }
  .qr-box { display: inline-block; width: 120px; height: 120px; border: 2px dashed #94a3b8; border-radius: 8px; line-height: 120px; color: #94a3b8; font-size: 24px; font-weight: bold; }
  @media print {
    body { background: #fff; }
    .slide { border: none; box-shadow: none; page-break-after: always; }
    .header { position: static; }
  }
  body.present .header, body.present .teacher-notes { display: none; }
  body.present .slides { max-width: 100%; padding: 0; margin: 0; }
  body.present .slide { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; border: none; border-radius: 0; margin: 0; scroll-snap-align: start; }
  body.present { scroll-snap-type: y mandatory; overflow-y: scroll; }
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>${slides.length} slidů · ${subtitle} · ZEdu Export</p>
</div>
<div class="slides">
${slidesHtml}
</div>
<script>
  document.addEventListener('keydown', (e) => {
    if (e.key === 'p') document.body.classList.toggle('present');
    if (e.key === 'n') document.querySelectorAll('.teacher-notes').forEach(n => n.style.display = n.style.display === 'none' ? '' : 'none');
  });
</script>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { lessonPlanId, format = "html", options = {} } = await req.json();

    const exportTarget = options.exportTarget || "teacher";
    const exportMode = options.mode || "live";

    const exportOptions = {
      includeTeacherNotes: exportTarget === "teacher" && (options.includeTeacherNotes ?? true),
      includeAnswerKey: exportTarget === "teacher" && (options.includeAnswerKey ?? true),
      includeQrCodes: options.includeQrCodes ?? (exportTarget === "teacher"),
      joinCode: options.joinCode || "",
      exportTarget,
      mode: exportMode,
    };

    // Fetch lesson plan
    const { data: plan, error: planErr } = await supabase
      .from("lesson_plans" as any)
      .select("*")
      .eq("id", lessonPlanId)
      .eq("teacher_id", user.id)
      .single();

    if (planErr || !plan) {
      return new Response(JSON.stringify({ error: "Plán nenalezen" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const slides = (plan as any).slides || [];
    const title = (plan as any).title || "Plán lekce";

    // Create export job
    const { data: job } = await supabase
      .from("export_jobs" as any)
      .insert({
        lesson_plan_id: lessonPlanId,
        teacher_id: user.id,
        format,
        status: "running",
        attempt: 1,
        options: exportOptions,
        started_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();

    const jobId = (job as any)?.id;
    const targetSuffix = exportTarget === "student" ? "_handout" : "_teacher";

    try {
      if (format === "html" || format === "pdf") {
        const html = generateFullHtml(slides, title, exportOptions);

        const fileName = `${user.id}/${jobId || crypto.randomUUID()}_${title.replace(/\s+/g, "_")}${targetSuffix}.html`;
        const { error: uploadErr } = await supabase.storage
          .from("exports")
          .upload(fileName, new Blob([html], { type: "text/html" }), { contentType: "text/html", upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("exports").getPublicUrl(fileName);

        if (jobId) {
          await supabase.from("export_jobs" as any).update({
            status: "succeeded",
            output_url: urlData.publicUrl,
            completed_at: new Date().toISOString(),
          } as any).eq("id", jobId);
        }

        const responsePayload: any = {
          format,
          url: urlData.publicUrl,
          jobId,
          exportTarget,
        };

        if (format === "pdf") {
          responsePayload.printInstructions = "Otevřete URL a použijte Ctrl+P pro tisk do PDF";
        }

        return new Response(JSON.stringify(responsePayload), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (format === "pptx") {
        const pptxData = {
          slides: slides.map((slide: any, i: number) => ({
            index: i + 1,
            type: slide.type,
            title: slide.projector?.headline || "",
            content: slide.projector?.body || "",
            deviceInstructions: slide.device?.instructions || "",
            teacherNotes: exportOptions.includeTeacherNotes ? (slide.teacherNotes || "") : "",
            activitySpec: exportOptions.includeAnswerKey ? (slide.activitySpec || null) : stripAnswers(slide.activitySpec),
          })),
          metadata: { title, slideCount: slides.length, exportTarget },
        };

        if (jobId) {
          await supabase.from("export_jobs" as any).update({
            status: "succeeded",
            completed_at: new Date().toISOString(),
          } as any).eq("id", jobId);
        }

        return new Response(JSON.stringify({
          format: "pptx",
          data: pptxData,
          jobId,
          exportTarget,
          note: "PPTX se generuje na straně klienta pomocí pptxgenjs",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Nepodporovaný formát: ${format}`);
    } catch (exportError) {
      if (jobId) {
        await supabase.from("export_jobs" as any).update({
          status: "failed",
          error_message: exportError instanceof Error ? exportError.message : "Unknown error",
        } as any).eq("id", jobId);
      }
      throw exportError;
    }
  } catch (e) {
    console.error("export-lesson error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

/** Strip answer keys from activitySpec for student exports */
function stripAnswers(spec: any): any {
  if (!spec) return null;
  const stripped = { ...spec };
  if (stripped.model) {
    const m = { ...stripped.model };
    delete m.correctIndex;
    delete m.correctAnswer;
    delete m.answers;
    // For matching, remove right-side mapping
    if (stripped.type === "matching" && m.pairs) {
      m.pairs = m.pairs.map((p: any) => ({ left: p.left, right: "___" }));
    }
    stripped.model = m;
  }
  return stripped;
}

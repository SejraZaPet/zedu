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

  const headline = slide.projector?.headline || "";
  const body = slide.projector?.body || "";
  const deviceInstructions = slide.device?.instructions || "";
  const notes = slide.teacherNotes || "";
  const typeColor = typeColors[slide.type] || "#6b7280";
  const typeLabel = typeLabels[slide.type] || slide.type;

  // Activity placeholder
  let activityHtml = "";
  if (slide.activitySpec) {
    const spec = slide.activitySpec;
    if (spec.type === "mcq" && spec.model?.choices) {
      activityHtml = `<div class="activity-box">
        <h4>📝 ${spec.prompt || ""}</h4>
        <ul>${spec.model.choices.map((c: string, i: number) => 
          `<li${i === spec.model.correctIndex && options.includeAnswerKey ? ' class="correct"' : ""}>${c}</li>`
        ).join("")}</ul>
      </div>`;
    } else if (spec.type === "matching" && spec.model?.pairs) {
      activityHtml = `<div class="activity-box">
        <h4>🔗 ${spec.prompt || "Spojování"}</h4>
        <table class="matching"><tbody>
          ${spec.model.pairs.map((p: any) => `<tr><td>${p.left}</td><td>→</td><td>${p.right}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
    }
  }

  // QR code placeholder
  const qrHtml = options.includeQrCodes && slide.type === "intro"
    ? `<div class="qr-placeholder"><div class="qr-box">QR</div><p>Připojte se na: <strong>${options.joinCode || "______"}</strong></p></div>`
    : "";

  // Teacher notes
  const notesHtml = options.includeTeacherNotes && notes
    ? `<div class="teacher-notes"><strong>📋 Poznámky:</strong> ${notes}</div>`
    : "";

  return `<section class="slide" data-slide="${index + 1}">
    <div class="slide-header">
      <span class="slide-badge" style="background:${typeColor}">${typeLabel}</span>
      <span class="slide-number">${index + 1}</span>
    </div>
    <div class="slide-content">
      <h2>${headline}</h2>
      <p class="body-text">${body}</p>
      ${qrHtml}
      ${activityHtml}
      <div class="device-section">
        <h4>📱 Zařízení žáka</h4>
        <p>${deviceInstructions}</p>
      </div>
    </div>
    ${notesHtml}
  </section>`;
}

function generateFullHtml(slides: any[], title: string, options: any): string {
  const slidesHtml = slides.map((s, i) => renderSlideToHtml(s, i, options)).join("\n");
  
  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
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
  .matching td { padding: 4px 12px; font-size: 14px; }
  .qr-placeholder { text-align: center; margin: 20px 0; }
  .qr-box { display: inline-block; width: 120px; height: 120px; border: 2px dashed #94a3b8; border-radius: 8px; line-height: 120px; color: #94a3b8; font-size: 24px; font-weight: bold; }
  @media print {
    body { background: #fff; }
    .slide { border: none; box-shadow: none; page-break-after: always; }
    .header { position: static; }
  }
  /* Presentation mode */
  body.present .header, body.present .teacher-notes { display: none; }
  body.present .slides { max-width: 100%; padding: 0; margin: 0; }
  body.present .slide { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; border: none; border-radius: 0; margin: 0; scroll-snap-align: start; }
  body.present { scroll-snap-type: y mandatory; overflow-y: scroll; }
</style>
</head>
<body>
<div class="header">
  <h1>${title}</h1>
  <p>${slides.length} slidů · ZEdu Live Export</p>
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

// ── PPTX generator (simplified, no external dep) ──────────
function generatePptxXml(slides: any[], title: string, options: any): { files: Record<string, string> } {
  // Generate a minimal PPTX-compatible Open XML
  // PPTX is a ZIP of XML files. We'll generate the minimal set.
  // For a real PPTX we'd need a proper library, but in Deno edge functions
  // we'll generate a simplified version that works in PowerPoint/Google Slides.
  
  const slideXmls: Record<string, string> = {};
  
  slides.forEach((slide, i) => {
    const headline = (slide.projector?.headline || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const body = (slide.projector?.body || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const deviceText = (slide.device?.instructions || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const notes = (slide.teacherNotes || "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    
    slideXmls[`ppt/slides/slide${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="cs-CZ" dirty="0"/><a:t>${headline}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="cs-CZ" dirty="0"/><a:t>${body}</a:t></a:r></a:p><a:p><a:r><a:rPr lang="cs-CZ" dirty="0"/><a:t></a:t></a:r></a:p><a:p><a:r><a:rPr lang="cs-CZ" dirty="0" b="1"/><a:t>📱 Žák: </a:t></a:r><a:r><a:rPr lang="cs-CZ" dirty="0"/><a:t>${deviceText}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  ${options.includeTeacherNotes && notes ? `<p:notes><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/><p:sp><p:nvSpPr><p:cNvPr id="2" name="Notes"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="cs-CZ"/><a:t>${notes}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>` : ""}
</p:sld>`;
  });

  return { files: slideXmls };
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

    const exportOptions = {
      includeTeacherNotes: options.includeTeacherNotes ?? true,
      includeAnswerKey: options.includeAnswerKey ?? false,
      includeQrCodes: options.includeQrCodes ?? true,
      joinCode: options.joinCode || "",
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
    const { data: job, error: jobErr } = await supabase
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

    if (jobErr) {
      console.error("Job creation error:", jobErr);
    }

    const jobId = (job as any)?.id;

    try {
      if (format === "html") {
        const html = generateFullHtml(slides, title, exportOptions);
        
        // Upload to storage
        const fileName = `${user.id}/${jobId || crypto.randomUUID()}_${title.replace(/\s+/g, "_")}.html`;
        const { error: uploadErr } = await supabase.storage
          .from("exports")
          .upload(fileName, new Blob([html], { type: "text/html" }), { contentType: "text/html", upsert: true });

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage.from("exports").getPublicUrl(fileName);

        // Update job
        if (jobId) {
          await supabase.from("export_jobs" as any).update({
            status: "succeeded",
            output_url: urlData.publicUrl,
            completed_at: new Date().toISOString(),
          } as any).eq("id", jobId);
        }

        return new Response(JSON.stringify({ 
          format: "html",
          url: urlData.publicUrl,
          jobId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (format === "pdf") {
        // PDF: Return HTML optimized for print (client will use window.print())
        const html = generateFullHtml(slides, title, exportOptions);
        
        const fileName = `${user.id}/${jobId || crypto.randomUUID()}_${title.replace(/\s+/g, "_")}_print.html`;
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

        return new Response(JSON.stringify({
          format: "pdf",
          url: urlData.publicUrl,
          printInstructions: "Otevřete URL a použijte Ctrl+P pro tisk do PDF",
          jobId,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (format === "pptx") {
        // Generate PPTX XML structure info (simplified)
        // Full PPTX generation would require ZIP library
        // Instead, return structured data for client-side PPTX generation
        const pptxData = {
          slides: slides.map((slide: any, i: number) => ({
            index: i + 1,
            type: slide.type,
            title: slide.projector?.headline || "",
            content: slide.projector?.body || "",
            deviceInstructions: slide.device?.instructions || "",
            teacherNotes: exportOptions.includeTeacherNotes ? (slide.teacherNotes || "") : "",
            activitySpec: slide.activitySpec || null,
          })),
          metadata: { title, slideCount: slides.length },
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
          note: "PPTX se generuje na straně klienta pomocí pptxgenjs",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      throw new Error(`Nepodporovaný formát: ${format}`);
    } catch (exportError) {
      // Update job as failed
      if (jobId) {
        const attempt = 1;
        const maxAttempts = 3;
        await supabase.from("export_jobs" as any).update({
          status: attempt >= maxAttempts ? "failed" : "queued",
          error_message: exportError instanceof Error ? exportError.message : "Unknown error",
          attempt,
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

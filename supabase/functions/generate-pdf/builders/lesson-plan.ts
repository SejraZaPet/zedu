import { PdfCtx, drawText, drawDivider, ensureSpace, drawHeader } from "../_shared/pdf-engine.ts";

interface Phase {
  phase_key?: string;
  title?: string | null;
  duration_min?: number;
  content?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  sort_order?: number;
}

interface LessonPlan {
  title?: string;
  subject?: string;
  grade_band?: string;
  slides?: any[];
}

const PHASE_LABELS: Record<string, string> = {
  intro: "Úvod",
  motivation: "Motivace",
  presentation: "Výklad",
  practice: "Procvičení",
  reflection: "Reflexe",
  closing: "Závěr",
};

export function buildLessonPlanPdf(
  ctx: PdfCtx,
  plan: LessonPlan,
  phases: Phase[],
  opts: { teacherName?: string; date?: string; className?: string } = {},
): void {
  const sub = [plan.subject, plan.grade_band].filter(Boolean).join(" · ");
  const meta = [opts.className, opts.teacherName, opts.date].filter(Boolean).join(" · ");
  drawHeader(ctx, plan.title || "Plán hodiny", [sub, meta].filter(Boolean).join("    "));

  const totalMin = phases.reduce((s, p) => s + (p.duration_min || 0), 0);
  if (totalMin > 0) {
    drawText(ctx, `Celková doba: ${totalMin} min`, { size: 10, color: { r: 0.45, g: 0.45, b: 0.5 } });
    drawDivider(ctx, 6, 8);
  }

  if (phases.length === 0) {
    drawText(ctx, "Plán neobsahuje žádné fáze.", {
      size: 11,
      color: { r: 0.6, g: 0.4, b: 0.4 },
    });
  }

  phases
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .forEach((phase, i) => {
      ensureSpace(ctx, 60);
      const label = PHASE_LABELS[phase.phase_key || ""] || phase.title || `Fáze ${i + 1}`;
      const time = [phase.start_time, phase.end_time].filter(Boolean).join("–");
      const duration = phase.duration_min ? `${phase.duration_min} min` : "";
      const headerLine = [`${i + 1}. ${label}`, time, duration].filter(Boolean).join("   ·   ");
      drawText(ctx, headerLine, { size: 12, bold: true });
      if (phase.title && PHASE_LABELS[phase.phase_key || ""] && phase.title !== label) {
        drawText(ctx, phase.title, { size: 10.5, bold: true, indent: 12 });
      }
      if (phase.content) {
        drawText(ctx, phase.content, { size: 10.5, indent: 12 });
      }
      ctx.cursorY -= 8;
    });

  // Slides outline (text-only per plan)
  if (Array.isArray(plan.slides) && plan.slides.length > 0) {
    ensureSpace(ctx, 80);
    drawDivider(ctx, 12, 10);
    drawText(ctx, `Přehled slidů (${plan.slides.length})`, { size: 14, bold: true });
    ctx.cursorY -= 4;
    plan.slides.forEach((slide: any, i: number) => {
      const slideTitle = slide?.title || slide?.headline || slide?.heading || `Slide ${i + 1}`;
      drawText(ctx, `${i + 1}. ${slideTitle}`, { size: 11, bold: true });
      const body = slide?.body || slide?.content || slide?.text || slide?.subtitle;
      if (body && typeof body === "string") {
        drawText(ctx, body, { size: 10, indent: 12 });
      }
    });
  }
}

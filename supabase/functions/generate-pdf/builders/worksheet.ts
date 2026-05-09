import { PdfCtx, drawText, drawDivider, ensureSpace, drawHeader } from "../_shared/pdf-engine.ts";

interface WorksheetTask {
  id?: string;
  type?: string;
  title?: string;
  prompt?: string;
  text?: string;
  question?: string;
  options?: any[];
  answers?: any[];
  correct_answer?: any;
  correctAnswer?: any;
  points?: number;
}

interface WorksheetData {
  title?: string;
  description?: string;
  subject?: string;
  grade_band?: string;
  spec?: any;
  blocks?: any[];
  tasks?: WorksheetTask[];
}

function getTasks(ws: WorksheetData): WorksheetTask[] {
  if (Array.isArray(ws.tasks) && ws.tasks.length) return ws.tasks;
  const spec = ws.spec ?? {};
  if (Array.isArray(spec.tasks)) return spec.tasks;
  if (Array.isArray(spec.blocks)) return spec.blocks;
  if (Array.isArray(ws.blocks)) return ws.blocks;
  return [];
}

function taskTitle(t: WorksheetTask): string {
  return t.title || t.prompt || t.question || t.text || "Úloha";
}

function taskBody(t: WorksheetTask): string {
  if (t.title && (t.prompt || t.text || t.question)) {
    return t.prompt || t.text || t.question || "";
  }
  return "";
}

export async function buildWorksheetPdf(
  ctx: PdfCtx,
  worksheet: WorksheetData,
  opts: { teacherName?: string; date?: string; includeAnswerKey?: boolean } = {},
): Promise<void> {
  const title = worksheet.title || "Pracovní list";
  const sub = [worksheet.subject, worksheet.grade_band].filter(Boolean).join(" · ");
  const meta = [opts.teacherName, opts.date].filter(Boolean).join(" · ");

  drawHeader(ctx, title, [sub, meta].filter(Boolean).join("    "));

  if (worksheet.description) {
    drawText(ctx, worksheet.description, { size: 11, color: { r: 0.3, g: 0.3, b: 0.35 } });
    ctx.cursorY -= 6;
  }

  // Name field
  drawText(ctx, "Jméno: ____________________________   Třída: __________   Datum: __________", {
    size: 10,
    color: { r: 0.35, g: 0.35, b: 0.4 },
  });
  drawDivider(ctx, 8, 10);

  const tasks = getTasks(worksheet);
  if (tasks.length === 0) {
    drawText(ctx, "Tento pracovní list zatím neobsahuje žádné úlohy.", {
      size: 11,
      color: { r: 0.6, g: 0.4, b: 0.4 },
    });
  }

  tasks.forEach((task, i) => {
    ensureSpace(ctx, 60);
    drawText(ctx, `${i + 1}. ${taskTitle(task)}`, { size: 12, bold: true });
    const body = taskBody(task);
    if (body) {
      drawText(ctx, body, { size: 11, indent: 12 });
    }

    // Options for MCQ
    if (Array.isArray(task.options) && task.options.length > 0) {
      ctx.cursorY -= 2;
      task.options.forEach((opt: any, idx: number) => {
        const label = String.fromCharCode(65 + idx);
        const text = typeof opt === "string" ? opt : (opt?.text ?? opt?.label ?? JSON.stringify(opt));
        drawText(ctx, `☐  ${label})  ${text}`, { size: 10.5, indent: 12 });
      });
    } else {
      // Open-ended: blank lines
      const lines = task.type === "long_text" ? 4 : 2;
      for (let l = 0; l < lines; l++) {
        ensureSpace(ctx, 18);
        ctx.page.drawLine({
          start: { x: ctx.margin + 12, y: ctx.cursorY - 6 },
          end: { x: ctx.width - ctx.margin, y: ctx.cursorY - 6 },
          thickness: 0.4,
          color: { type: "RGB", red: 0.7, green: 0.7, blue: 0.75 } as any,
        });
        ctx.cursorY -= 18;
      }
    }

    if (task.points) {
      drawText(ctx, `(${task.points} b.)`, {
        size: 9,
        indent: 12,
        color: { r: 0.5, g: 0.5, b: 0.55 },
      });
    }
    ctx.cursorY -= 6;
  });

  // Answer key
  if (opts.includeAnswerKey && tasks.some((t) => t.correct_answer || t.correctAnswer || t.answers)) {
    ensureSpace(ctx, 60);
    drawDivider(ctx, 12, 10);
    drawText(ctx, "Klíč k řešení", { size: 14, bold: true });
    ctx.cursorY -= 4;
    tasks.forEach((task, i) => {
      const ans = task.correct_answer ?? task.correctAnswer ?? task.answers;
      if (ans === undefined || ans === null) return;
      const ansStr = typeof ans === "string" || typeof ans === "number" ? String(ans) : JSON.stringify(ans);
      drawText(ctx, `${i + 1}. ${ansStr}`, { size: 10.5 });
    });
  }
}

import { PDFDocument, rgb } from "npm:pdf-lib@1.17.1";
import { PdfCtx, drawHeader } from "./pdf-engine.ts";

interface ScheduleSlot {
  day_of_week: number; // 1=Mon ... 7=Sun
  start_time: string;
  end_time: string;
  subject_label?: string | null;
  abbreviation?: string | null;
  room?: string | null;
  color?: string | null;
  week_parity?: string | null;
}

interface ClassInfo {
  name?: string;
  field_of_study?: string;
  year?: number | null;
}

const DAYS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

function hmToMin(t: string): number {
  const [h, m] = t.split(":").map((x) => parseInt(x, 10));
  return h * 60 + (m || 0);
}

function hexToRgb01(hex: string): { r: number; g: number; b: number } {
  const m = hex.replace("#", "").match(/.{1,2}/g);
  if (!m || m.length < 3) return { r: 0.85, g: 0.92, b: 0.98 };
  return {
    r: parseInt(m[0], 16) / 255,
    g: parseInt(m[1], 16) / 255,
    b: parseInt(m[2], 16) / 255,
  };
}

export function buildSchedulePdf(
  ctx: PdfCtx,
  klass: ClassInfo,
  slots: ScheduleSlot[],
  opts: { teacherName?: string; date?: string } = {},
): void {
  const sub = [klass.field_of_study, klass.year ? `${klass.year}. ročník` : null]
    .filter(Boolean)
    .join(" · ");
  const meta = [opts.teacherName, opts.date].filter(Boolean).join(" · ");
  drawHeader(ctx, `Rozvrh — ${klass.name || "třída"}`, [sub, meta].filter(Boolean).join("    "));

  // Compute time range
  const validSlots = slots.filter((s) => s.start_time && s.end_time);
  if (validSlots.length === 0) {
    ctx.page.drawText("Žádné rozvrhové sloty.", {
      x: ctx.margin,
      y: ctx.cursorY - 20,
      size: 12,
      font: ctx.font,
      color: rgb(0.55, 0.4, 0.4),
    });
    return;
  }

  const minStart = Math.min(...validSlots.map((s) => hmToMin(s.start_time)));
  const maxEnd = Math.max(...validSlots.map((s) => hmToMin(s.end_time)));
  // Round to whole hours
  const startMin = Math.floor(minStart / 60) * 60;
  const endMin = Math.ceil(maxEnd / 60) * 60;
  const totalMin = endMin - startMin;

  // Grid geometry
  const gridLeft = ctx.margin + 36; // space for time labels
  const gridTop = ctx.cursorY - 6;
  const gridRight = ctx.width - ctx.margin;
  const gridBottom = ctx.margin + 30;
  const gridWidth = gridRight - gridLeft;
  const gridHeight = gridTop - gridBottom;

  const days = 5; // Mon-Fri
  const colWidth = gridWidth / days;
  const pxPerMin = gridHeight / totalMin;

  // Day headers
  for (let d = 0; d < days; d++) {
    const x = gridLeft + d * colWidth;
    ctx.page.drawRectangle({
      x,
      y: gridTop,
      width: colWidth,
      height: 18,
      color: rgb(0.96, 0.96, 0.98),
    });
    ctx.page.drawText(DAYS[d], {
      x: x + colWidth / 2 - 6,
      y: gridTop + 5,
      size: 10,
      font: ctx.fontBold,
      color: rgb(0.2, 0.2, 0.25),
    });
  }

  // Time grid lines (every hour)
  for (let m = startMin; m <= endMin; m += 60) {
    const y = gridTop - (m - startMin) * pxPerMin;
    ctx.page.drawLine({
      start: { x: gridLeft, y },
      end: { x: gridRight, y },
      thickness: 0.3,
      color: rgb(0.85, 0.85, 0.88),
    });
    const hh = Math.floor(m / 60);
    ctx.page.drawText(`${String(hh).padStart(2, "0")}:00`, {
      x: ctx.margin,
      y: y - 4,
      size: 8,
      font: ctx.font,
      color: rgb(0.5, 0.5, 0.55),
    });
  }

  // Day separator lines
  for (let d = 0; d <= days; d++) {
    const x = gridLeft + d * colWidth;
    ctx.page.drawLine({
      start: { x, y: gridTop },
      end: { x, y: gridBottom },
      thickness: 0.4,
      color: rgb(0.8, 0.8, 0.85),
    });
  }

  // Render slots
  validSlots.forEach((s) => {
    const dayIdx = s.day_of_week - 1; // 1=Mon
    if (dayIdx < 0 || dayIdx >= days) return;
    const top = gridTop - (hmToMin(s.start_time) - startMin) * pxPerMin;
    const bottom = gridTop - (hmToMin(s.end_time) - startMin) * pxPerMin;
    const x = gridLeft + dayIdx * colWidth + 2;
    const w = colWidth - 4;
    const h = top - bottom;
    const color = hexToRgb01(s.color || "#DCE9F7");
    ctx.page.drawRectangle({
      x,
      y: bottom,
      width: w,
      height: h,
      color: rgb(color.r, color.g, color.b),
      borderColor: rgb(color.r * 0.7, color.g * 0.7, color.b * 0.7),
      borderWidth: 0.5,
    });
    const label = s.abbreviation || s.subject_label || "—";
    ctx.page.drawText(label, {
      x: x + 4,
      y: top - 12,
      size: 9,
      font: ctx.fontBold,
      color: rgb(0.15, 0.15, 0.2),
    });
    if (s.room) {
      ctx.page.drawText(s.room, {
        x: x + 4,
        y: top - 24,
        size: 7,
        font: ctx.font,
        color: rgb(0.35, 0.35, 0.4),
      });
    }
    if (s.start_time && s.end_time && h > 22) {
      ctx.page.drawText(`${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`, {
        x: x + 4,
        y: bottom + 4,
        size: 7,
        font: ctx.font,
        color: rgb(0.4, 0.4, 0.45),
      });
    }
  });
}

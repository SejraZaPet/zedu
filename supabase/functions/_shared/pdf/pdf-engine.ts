// Lightweight PDF engine for Deno Edge Runtime.
// Uses pdf-lib + fontkit and embeds Noto Sans (Czech-capable Unicode font).
// Cached per warm instance via module-level promise.

import { PDFDocument, rgb, StandardFonts, PDFFont, PDFPage } from "npm:pdf-lib@1.17.1";
import fontkit from "npm:@pdf-lib/fontkit@1.1.1";

const FONT_REGULAR_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-ext-400-normal.ttf";
const FONT_BOLD_URL =
  "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans@latest/latin-ext-700-normal.ttf";

let fontPromise: Promise<{ regular: Uint8Array; bold: Uint8Array }> | null = null;

async function loadFonts(): Promise<{ regular: Uint8Array; bold: Uint8Array }> {
  if (fontPromise) return fontPromise;
  fontPromise = (async () => {
    const [r, b] = await Promise.all([
      fetch(FONT_REGULAR_URL),
      fetch(FONT_BOLD_URL),
    ]);
    if (!r.ok || !b.ok) {
      throw new Error(`Font fetch failed: ${r.status}/${b.status}`);
    }
    return {
      regular: new Uint8Array(await r.arrayBuffer()),
      bold: new Uint8Array(await b.arrayBuffer()),
    };
  })();
  return fontPromise;
}

export interface PdfCtx {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  page: PDFPage;
  cursorY: number;
  // page geometry
  margin: number;
  width: number;
  height: number;
}

export type PdfOrientation = "portrait" | "landscape";

export async function createPdf(orientation: PdfOrientation = "portrait"): Promise<PdfCtx> {
  const { regular, bold } = await loadFonts();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(regular, { subset: true });
  const fontBold = await doc.embedFont(bold, { subset: true });

  // A4 in points: 595 x 842
  const [w, h] = orientation === "landscape" ? [842, 595] : [595, 842];
  const margin = 48;
  const page = doc.addPage([w, h]);
  return {
    doc,
    font,
    fontBold,
    page,
    cursorY: h - margin,
    margin,
    width: w,
    height: h,
  };
}

export function newPage(ctx: PdfCtx): void {
  ctx.page = ctx.doc.addPage([ctx.width, ctx.height]);
  ctx.cursorY = ctx.height - ctx.margin;
}

export function ensureSpace(ctx: PdfCtx, needed: number): void {
  if (ctx.cursorY - needed < ctx.margin) newPage(ctx);
}

export interface DrawTextOpts {
  size?: number;
  bold?: boolean;
  color?: { r: number; g: number; b: number };
  maxWidth?: number;
  lineGap?: number;
  indent?: number;
}

/**
 * Draw text with simple wrapping. Updates ctx.cursorY downward.
 */
export function drawText(ctx: PdfCtx, text: string, opts: DrawTextOpts = {}): void {
  const size = opts.size ?? 11;
  const bold = opts.bold ?? false;
  const color = opts.color ?? { r: 0.1, g: 0.1, b: 0.1 };
  const lineGap = opts.lineGap ?? 4;
  const indent = opts.indent ?? 0;
  const maxWidth = opts.maxWidth ?? ctx.width - ctx.margin * 2 - indent;
  const f = bold ? ctx.fontBold : ctx.font;

  // Sanitize: pdf-lib can't render certain chars; replace tabs/CR
  const clean = String(text ?? "").replace(/\r/g, "").replace(/\t/g, "  ");
  const paragraphs = clean.split(/\n/);

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const candidate = line ? line + " " + w : w;
      const width = f.widthOfTextAtSize(candidate, size);
      if (width > maxWidth && line) {
        ensureSpace(ctx, size + lineGap);
        ctx.page.drawText(line, {
          x: ctx.margin + indent,
          y: ctx.cursorY - size,
          size,
          font: f,
          color: rgb(color.r, color.g, color.b),
        });
        ctx.cursorY -= size + lineGap;
        line = w;
      } else {
        line = candidate;
      }
    }
    if (line) {
      ensureSpace(ctx, size + lineGap);
      ctx.page.drawText(line, {
        x: ctx.margin + indent,
        y: ctx.cursorY - size,
        size,
        font: f,
        color: rgb(color.r, color.g, color.b),
      });
      ctx.cursorY -= size + lineGap;
    }
    // empty paragraph spacing
    if (!line && paragraphs.length > 1) ctx.cursorY -= size * 0.4;
  }
}

export function drawDivider(ctx: PdfCtx, gapBefore = 6, gapAfter = 6): void {
  ensureSpace(ctx, gapBefore + 1 + gapAfter);
  ctx.cursorY -= gapBefore;
  ctx.page.drawLine({
    start: { x: ctx.margin, y: ctx.cursorY },
    end: { x: ctx.width - ctx.margin, y: ctx.cursorY },
    thickness: 0.5,
    color: rgb(0.75, 0.75, 0.78),
  });
  ctx.cursorY -= gapAfter;
}

export function drawHeader(
  ctx: PdfCtx,
  title: string,
  subtitle?: string,
): void {
  // Brand bar
  ctx.page.drawRectangle({
    x: 0,
    y: ctx.height - 28,
    width: ctx.width,
    height: 28,
    color: rgb(0.43, 0.78, 0.85), // #6EC6D9 ish
  });
  ctx.page.drawText("ZEdu", {
    x: ctx.margin,
    y: ctx.height - 20,
    size: 12,
    font: ctx.fontBold,
    color: rgb(1, 1, 1),
  });
  ctx.cursorY = ctx.height - 28 - 24;
  drawText(ctx, title, { size: 18, bold: true });
  if (subtitle) {
    drawText(ctx, subtitle, { size: 10, color: { r: 0.45, g: 0.45, b: 0.5 } });
  }
  drawDivider(ctx, 6, 10);
}

export function drawFooter(ctx: PdfCtx, text: string): void {
  // Iterate all pages and add footer
  const pages = ctx.doc.getPages();
  pages.forEach((p, idx) => {
    p.drawText(`${text}  ·  Strana ${idx + 1} / ${pages.length}`, {
      x: ctx.margin,
      y: 20,
      size: 8,
      font: ctx.font,
      color: rgb(0.55, 0.55, 0.6),
    });
  });
}

export async function finalizePdf(ctx: PdfCtx): Promise<Uint8Array> {
  return await ctx.doc.save();
}

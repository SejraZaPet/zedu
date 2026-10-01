import DOMPurify from "dompurify";
import { Extension } from "@tiptap/core";
import type { NotebookTextBox } from "@/lib/notebook";

/** Šířka stránky v jednotkách sešitu (shodné s NB_W v notebook.ts). */
const PAGE_W = 1000;
export const NB_LINE_HEIGHT = 1.25;
export const NB_FONT_FAMILY = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
export const NB_FONT_SIZES = [16, 20, 24, 32, 40, 48, 64, 80] as const;

const SAFE_COLOR = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\))$/i;
const ALLOWED_TAGS = ["p", "br", "strong", "b", "em", "i", "u", "span", "mark"];

const clampSize = (n: number) => Math.max(8, Math.min(200, Math.round(n)));
export const sizeToCqw = (n: number) => `${(n / PAGE_W) * 100}cqw`;

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Starý prostý text → odstavce pro editor. */
export const plainToNotebookHtml = (text: string) =>
  (text || "").split(/\r?\n/).map((l) => `<p>${l ? escapeHtml(l) : ""}</p>`).join("");

/** Bezpečný HTML: jen tučně/kurzíva/podtržení, barva, podbarvení a velikost. */
export function sanitizeNotebookHtml(value: string): string {
  const clean = DOMPurify.sanitize(value || "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["style", "data-size", "data-color"],
  });
  const box = document.createElement("div");
  box.innerHTML = clean;
  box.querySelectorAll<HTMLElement>("*").forEach((el) => {
    const color = el.style.color.trim();
    const bg = (el.getAttribute("data-color") || el.style.backgroundColor || "").trim();
    const sizeAttr = Number(el.getAttribute("data-size"));
    el.removeAttribute("style");
    el.removeAttribute("data-color");
    el.removeAttribute("data-size");
    if (color && SAFE_COLOR.test(color)) el.style.color = color;
    if (el.tagName === "MARK") {
      const c = SAFE_COLOR.test(bg) ? bg : "#FEF08A";
      el.setAttribute("data-color", c);
      el.style.backgroundColor = c;
      if (!el.style.color) el.style.color = "inherit";
    }
    if (el.tagName === "SPAN" && Number.isFinite(sizeAttr) && sizeAttr > 0) {
      const n = clampSize(sizeAttr);
      el.setAttribute("data-size", String(n));
      el.style.fontSize = sizeToCqw(n);
    }
  });
  return box.innerHTML;
}

/** HTML bloku k zobrazení (staré bloky bez html se převedou z textu). */
export const textBoxHtml = (tb: NotebookTextBox) =>
  tb.html ? sanitizeNotebookHtml(tb.html) : plainToNotebookHtml(tb.text);

/** Tiptap: velikost písma jako atribut textStyle (ukládá se v jednotkách stránky). */
declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    notebookFontSize: {
      setNotebookFontSize: (size: number) => ReturnType;
      unsetNotebookFontSize: () => ReturnType;
    };
  }
}

export const NotebookFontSize = Extension.create({
  name: "notebookFontSize",
  addGlobalAttributes() {
    return [{
      types: ["textStyle"],
      attributes: {
        fontSize: {
          default: null,
          parseHTML: (el) => {
            const n = Number(el.getAttribute("data-size"));
            return Number.isFinite(n) && n > 0 ? clampSize(n) : null;
          },
          renderHTML: (attrs) => {
            if (!attrs.fontSize) return {};
            return { "data-size": String(attrs.fontSize), style: `font-size: ${sizeToCqw(attrs.fontSize)}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setNotebookFontSize: (size: number) => ({ chain }) =>
        chain().setMark("textStyle", { fontSize: clampSize(size) }).run(),
      unsetNotebookFontSize: () => ({ chain }) =>
        chain().setMark("textStyle", { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

/* ---------------- vykreslení do canvasu (PDF, portfolio, náhledy) ---------------- */

interface Run {
  text: string;
  size: number; // jednotky stránky
  bold: boolean;
  italic: boolean;
  underline: boolean;
  color: string;
  bg: string | null;
}

function collectParagraphs(html: string, base: Omit<Run, "text">): Run[][] {
  const root = document.createElement("div");
  root.innerHTML = html;
  const paragraphs: Run[][] = [];
  let current: Run[] = [];

  const walk = (node: Node, style: Omit<Run, "text">) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const t = node.textContent ?? "";
      if (t) current.push({ ...style, text: t });
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    const tag = node.tagName;
    if (tag === "BR") { paragraphs.push(current); current = []; return; }
    const s = { ...style };
    if (tag === "STRONG" || tag === "B") s.bold = true;
    if (tag === "EM" || tag === "I") s.italic = true;
    if (tag === "U") s.underline = true;
    if (node.style.color && node.style.color !== "inherit") s.color = node.style.color;
    if (tag === "MARK") s.bg = node.getAttribute("data-color") || node.style.backgroundColor || "#FEF08A";
    const ds = Number(node.getAttribute("data-size"));
    if (Number.isFinite(ds) && ds > 0) s.size = ds;
    node.childNodes.forEach((c) => walk(c, s));
  };

  root.childNodes.forEach((child) => {
    if (child instanceof HTMLElement && child.tagName === "P") {
      walk(child, base);
      paragraphs.push(current);
      current = [];
    } else {
      walk(child, base);
    }
  });
  if (current.length) paragraphs.push(current);
  return paragraphs;
}

const fontOf = (r: Run, scale: number) =>
  `${r.italic ? "italic " : ""}${r.bold ? "700" : "400"} ${r.size * scale}px ${NB_FONT_FAMILY}`;

/**
 * Vykreslí textový blok včetně úseků s vlastní velikostí, barvou a podbarvením.
 * `scale` = px canvasu na jednotku stránky (šířka canvasu / 1000).
 */
export function drawNotebookTextBox(
  ctx: CanvasRenderingContext2D,
  tb: NotebookTextBox,
  w: number,
  h: number,
  scale: number,
) {
  const base: Omit<Run, "text"> = {
    size: tb.fontSize, bold: !!tb.bold, italic: !!tb.italic, underline: false, color: tb.color, bg: null,
  };
  const paragraphs = collectParagraphs(textBoxHtml(tb), base);
  const maxW = tb.w * w;
  const x0 = tb.x * w;
  let y = tb.y * h;

  ctx.save();
  ctx.textBaseline = "alphabetic";
  for (const para of paragraphs) {
    // rozdělit na slova a mezery se zachováním stylu
    const tokens: Run[] = [];
    for (const r of para) {
      for (const part of r.text.split(/(\s+)/)) if (part) tokens.push({ ...r, text: part });
    }
    const lines: { runs: (Run & { width: number })[]; width: number }[] = [];
    let line: (Run & { width: number })[] = [];
    let lineW = 0;
    for (const t of tokens) {
      ctx.font = fontOf(t, scale);
      const tw = ctx.measureText(t.text).width;
      const isSpace = /^\s+$/.test(t.text);
      if (!isSpace && lineW + tw > maxW && line.length) {
        while (line.length && /^\s+$/.test(line[line.length - 1].text)) lineW -= line.pop()!.width;
        lines.push({ runs: line, width: lineW });
        line = []; lineW = 0;
      }
      if (isSpace && !line.length) continue;
      line.push({ ...t, width: tw });
      lineW += tw;
    }
    lines.push({ runs: line, width: lineW });

    for (const ln of lines) {
      const maxSize = ln.runs.reduce((m, r) => Math.max(m, r.size), para[0]?.size ?? base.size) * scale;
      const lh = maxSize * NB_LINE_HEIGHT;
      const baseline = y + (lh - maxSize) / 2 + maxSize * 0.82;
      let x = x0;
      for (const r of ln.runs) {
        const sz = r.size * scale;
        if (r.bg) {
          ctx.fillStyle = r.bg;
          ctx.fillRect(x, baseline - sz * 0.92, r.width, sz * 1.18);
        }
        ctx.font = fontOf(r, scale);
        ctx.fillStyle = r.color;
        ctx.fillText(r.text, x, baseline);
        if (r.underline) ctx.fillRect(x, baseline + sz * 0.1, r.width, Math.max(1, sz * 0.06));
        x += r.width;
      }
      y += lh;
    }
  }
  ctx.restore();
}

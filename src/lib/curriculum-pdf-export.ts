/**
 * PDF export předmětového ŠVP z blokového obsahu.
 * Staví na existujícím mechanismu appky – HTML → PDF přes `downloadHtmlAsPdf`
 * (html2pdf.js), stejně jako ostatní klientské exporty.
 */
import { downloadHtmlAsPdf } from "@/lib/html-to-pdf";
import type { Block } from "@/lib/textbook-config";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripHtml = (v: unknown) =>
  String(v ?? "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();

function blockToHtml(block: Block): string {
  if (block.visible === false) return "";
  const p = block.props ?? {};
  switch (block.type) {
    case "heading": {
      const level = Math.min(Math.max(Number(p.level) || 2, 2), 4);
      const text = stripHtml(p.text);
      return text ? `<h${level}>${esc(text)}</h${level}>` : "";
    }
    case "table": {
      const headers: string[] = Array.isArray(p.headers) ? p.headers : [];
      const rows: string[][] = Array.isArray(p.rows) ? p.rows : [];
      const head = headers.length
        ? `<thead><tr>${headers.map((h) => `<th>${esc(stripHtml(h))}</th>`).join("")}</tr></thead>`
        : "";
      const body = `<tbody>${rows
        .map(
          (row) =>
            `<tr>${(row ?? [])
              .map((c) => `<td>${esc(stripHtml(c)).replace(/\n/g, "<br>")}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
      return `<table>${head}${body}</table>`;
    }
    case "bullet_list": {
      const items: string[] = Array.isArray(p.items) ? p.items : [];
      if (items.length) {
        return `<ul>${items
          .map((i) => stripHtml(i))
          .filter(Boolean)
          .map((i) => `<li>${esc(i)}</li>`)
          .join("")}</ul>`;
      }
      const text = stripHtml(p.html);
      return text ? `<p>${esc(text).replace(/\n/g, "<br>")}</p>` : "";
    }
    case "divider":
      return `<hr>`;
    default: {
      const text = stripHtml(p.text ?? p.html ?? p.content);
      return text ? `<p>${esc(text).replace(/\n/g, "<br>")}</p>` : "";
    }
  }
}

export interface CurriculumPdfOptions {
  title: string;
  subject: string;
  blocks: Block[];
}

export async function downloadCurriculumPdf(opts: CurriculumPdfOptions): Promise<void> {
  const bodyHtml = opts.blocks.map(blockToHtml).filter(Boolean).join("\n");
  const dateStr = new Date().toLocaleDateString("cs-CZ");

  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<title>${esc(opts.title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt; line-height: 1.55; color: #1e293b; background: #fff; padding: 0;
  }
  .doc-header {
    border-bottom: 2pt solid #0f172a; padding-bottom: 8pt; margin-bottom: 16pt;
  }
  .doc-header h1 { font-size: 18pt; font-weight: 700; }
  .doc-header .meta { font-size: 9pt; color: #64748b; margin-top: 2pt; }
  h2 { font-size: 14pt; font-weight: 700; color: #0f172a; margin: 14pt 0 4pt; page-break-after: avoid; }
  h3 { font-size: 12pt; font-weight: 600; color: #334155; margin: 10pt 0 3pt; page-break-after: avoid; }
  h4 { font-size: 10.5pt; font-weight: 600; color: #475569; margin: 8pt 0 3pt; }
  p { margin-bottom: 6pt; orphans: 2; widows: 2; }
  ul { margin: 4pt 0 6pt 16pt; }
  li { margin-bottom: 2pt; }
  hr { border: none; border-top: 0.5pt solid #e2e8f0; margin: 10pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 10pt; page-break-inside: avoid; }
  th, td { border: 0.5pt solid #cbd5e1; padding: 4pt 6pt; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  .doc-footer {
    margin-top: 18pt; padding-top: 6pt; border-top: 0.5pt solid #e2e8f0;
    font-size: 7.5pt; color: #94a3b8; text-align: center;
  }
</style>
</head>
<body>
<div class="doc-header">
  <h1>${esc(opts.title)}</h1>
  <div class="meta">Předmět: ${esc(opts.subject)} · Vygenerováno ${dateStr}</div>
</div>
${bodyHtml || "<p>Dokument neobsahuje žádný obsah.</p>"}
<div class="doc-footer">Bezli · Školní vzdělávací program · ${dateStr}</div>
</body>
</html>`;

  const safe = (opts.title || "svp").replace(/[^\p{L}\p{N}\-_ ]/gu, "").trim() || "svp";
  await downloadHtmlAsPdf({ html, filename: `${safe}.pdf` });
}

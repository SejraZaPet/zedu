/**
 * PDF Export Templates — HTML/CSS templates and pagination rules
 * for generating print-ready PDF exports.
 *
 * Two paper formats:
 *   - A4 (210×297mm) — worksheets, handouts
 *   - 16:9 (254×143mm landscape) — slide handouts
 *
 * Pagination rules prevent splitting activities, images,
 * and logical slide groups across page boundaries.
 */

// ────────────────── Paper Config ──────────────────

export type PaperFormat = "A4" | "16:9";

export interface PaperConfig {
  format: PaperFormat;
  widthMm: number;
  heightMm: number;
  orientation: "portrait" | "landscape";
  marginMm: { top: number; right: number; bottom: number; left: number };
  /** Usable content area in mm */
  contentWidthMm: number;
  contentHeightMm: number;
}

export const PAPER_A4: PaperConfig = {
  format: "A4",
  widthMm: 210,
  heightMm: 297,
  orientation: "portrait",
  marginMm: { top: 18, right: 16, bottom: 20, left: 16 },
  contentWidthMm: 178,
  contentHeightMm: 259,
};

export const PAPER_16_9: PaperConfig = {
  format: "16:9",
  widthMm: 254,
  heightMm: 143,
  orientation: "landscape",
  marginMm: { top: 10, right: 14, bottom: 12, left: 14 },
  contentWidthMm: 226,
  contentHeightMm: 121,
};

export function getPaperConfig(format: PaperFormat): PaperConfig {
  return format === "16:9" ? PAPER_16_9 : PAPER_A4;
}

// ────────────────── Pagination Rules ──────────────────

export interface PaginationRule {
  id: string;
  description: string;
  /** CSS property/value that enforces the rule */
  css: string;
}

export const PAGINATION_RULES: PaginationRule[] = [
  {
    id: "no-split-activity",
    description: "Nikdy nerozdělovat aktivitu (quiz, matching, atd.) přes stránku",
    css: ".activity-box, .slide-activity { break-inside: avoid; page-break-inside: avoid; }",
  },
  {
    id: "no-split-slide",
    description: "Celý slide blok se nerozděluje přes stránku",
    css: ".slide { break-inside: avoid; page-break-inside: avoid; }",
  },
  {
    id: "heading-with-content",
    description: "Nadpis se neodtrhne od následujícího obsahu",
    css: "h2, h3, h4 { break-after: avoid; page-break-after: avoid; orphans: 2; widows: 2; }",
  },
  {
    id: "no-split-image",
    description: "Obrázek se nerozděluje",
    css: "img, figure, .image-block { break-inside: avoid; page-break-inside: avoid; }",
  },
  {
    id: "no-split-table",
    description: "Tabulka (matching, srovnání) se nerozděluje",
    css: "table, .matching-table { break-inside: avoid; page-break-inside: avoid; }",
  },
  {
    id: "force-break-after-intro",
    description: "Po úvodním slidu vždy nová stránka",
    css: ".slide[data-type='intro'] { break-after: page; page-break-after: always; }",
  },
  {
    id: "orphan-widow",
    description: "Minimálně 2 řádky nahoře i dole stránky",
    css: "p, li { orphans: 2; widows: 2; }",
  },
  {
    id: "max-slide-height",
    description: "Slide vyšší než stránka se nesmí zlomit, dostane vlastní stránku",
    css: ".slide--oversized { break-before: page; page-break-before: always; }",
  },
];

// ────────────────── CSS Generator ──────────────────

function buildPaginationCss(): string {
  return PAGINATION_RULES.map(r => `/* ${r.id}: ${r.description} */\n${r.css}`).join("\n\n");
}

function buildBaseCss(paper: PaperConfig): string {
  const isLandscape = paper.orientation === "landscape";
  const pageSize = paper.format === "A4"
    ? "A4 portrait"
    : `${paper.widthMm}mm ${paper.heightMm}mm landscape`;

  return `
/* ═══ ZEdu PDF Export – ${paper.format} ═══ */

@page {
  size: ${pageSize};
  margin: ${paper.marginMm.top}mm ${paper.marginMm.right}mm ${paper.marginMm.bottom}mm ${paper.marginMm.left}mm;
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-size: 8pt;
    color: #94a3b8;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }
}

/* ─── Reset & Base ─── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

body {
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 11pt;
  line-height: 1.55;
  color: #1e293b;
  background: #fff;
  max-width: ${paper.contentWidthMm}mm;
  margin: 0 auto;
}

/* ─── Typography ─── */
h1 { font-size: 18pt; font-weight: 700; margin-bottom: 4pt; letter-spacing: -0.01em; }
h2 { font-size: 14pt; font-weight: 700; margin-bottom: 3pt; color: #0f172a; }
h3 { font-size: 12pt; font-weight: 600; margin-bottom: 2pt; color: #334155; }
h4 { font-size: 10pt; font-weight: 600; margin-bottom: 2pt; color: #475569; }
p  { margin-bottom: 6pt; }

/* ─── Print-friendly contrast ─── */
.text-muted { color: #64748b; }
.text-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #94a3b8; font-weight: 600; }

/* ─── Header / footer ─── */
.doc-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  border-bottom: 2pt solid #0f172a;
  padding-bottom: 6pt;
  margin-bottom: 14pt;
}
.doc-header h1 { flex: 1; }
.doc-header .meta { font-size: 9pt; color: #64748b; text-align: right; }
.doc-footer {
  margin-top: 20pt;
  padding-top: 6pt;
  border-top: 0.5pt solid #e2e8f0;
  font-size: 7pt;
  color: #94a3b8;
  text-align: center;
}

/* ─── Slide blocks ─── */
.slide {
  border: 0.75pt solid #e2e8f0;
  border-radius: 6pt;
  padding: 12pt 14pt;
  margin-bottom: 10pt;
  background: #fff;
}
.slide-header {
  display: flex;
  align-items: center;
  gap: 8pt;
  margin-bottom: 8pt;
}
.slide-badge {
  display: inline-block;
  padding: 1.5pt 8pt;
  border-radius: 10pt;
  font-size: 7.5pt;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.slide-number {
  font-size: 8pt;
  font-weight: 600;
  color: #94a3b8;
  margin-left: auto;
}

/* ─── Content regions ─── */
.slide-content { }
.slide-content h2 { font-size: 13pt; margin-bottom: 4pt; }
.slide-content .body-text {
  font-size: 10.5pt;
  line-height: 1.55;
  color: #334155;
  white-space: pre-wrap;
}
.two-column {
  display: flex;
  gap: 12pt;
}
.two-column .col-primary { flex: 3; }
.two-column .col-secondary { flex: 2; }

/* ─── Activities ─── */
.activity-box {
  margin-top: 8pt;
  padding: 10pt 12pt;
  border: 1.5pt solid #e2e8f0;
  border-radius: 5pt;
  background: #fefce8;
}
.activity-box h4 {
  font-size: 10pt;
  margin-bottom: 4pt;
}
.activity-box ul, .activity-box ol {
  padding-left: 16pt;
  margin: 4pt 0;
}
.activity-box li {
  padding: 3pt 0;
  font-size: 10pt;
  line-height: 1.5;
}
.activity-box li.correct {
  font-weight: 700;
  color: #15803d;
}
.matching-table {
  width: 100%;
  border-collapse: collapse;
  margin: 4pt 0;
}
.matching-table td {
  padding: 3pt 8pt;
  font-size: 10pt;
  border-bottom: 0.5pt solid #e2e8f0;
}
.matching-table td.blank-cell {
  border-bottom: 1pt dotted #94a3b8;
  min-width: 80pt;
}
.fill-line {
  display: inline-block;
  min-width: 60pt;
  border-bottom: 1pt solid #1e293b;
  margin: 0 2pt;
}

/* ─── Answer area / student space ─── */
.answer-space {
  min-height: ${paper.format === "A4" ? "60pt" : "36pt"};
  border: 1pt dashed #cbd5e1;
  border-radius: 4pt;
  margin-top: 6pt;
  position: relative;
}
.answer-space::after {
  content: "Místo pro odpověď";
  position: absolute;
  top: 4pt;
  left: 8pt;
  font-size: 7pt;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ─── Teacher notes (hidden in student export) ─── */
.teacher-notes {
  margin-top: 6pt;
  padding: 6pt 10pt;
  border-left: 3pt solid #6366f1;
  background: #f8fafc;
  font-size: 9pt;
  color: #64748b;
}
.student-export .teacher-notes { display: none !important; }

/* ─── QR placeholder ─── */
.qr-placeholder {
  text-align: center;
  margin: 8pt 0;
}
.qr-box {
  display: inline-block;
  width: 60pt;
  height: 60pt;
  border: 1.5pt dashed #94a3b8;
  border-radius: 4pt;
  line-height: 60pt;
  font-size: 14pt;
  font-weight: 700;
  color: #94a3b8;
}
.qr-label {
  font-size: 8pt;
  color: #64748b;
  margin-top: 2pt;
}

/* ─── Device section ─── */
.device-section {
  margin-top: 8pt;
  padding: 6pt 10pt;
  background: #f1f5f9;
  border-radius: 4pt;
  font-size: 9pt;
}
.device-section h4 { font-size: 8pt; color: #64748b; margin-bottom: 2pt; }

/* ─── Images ─── */
img {
  max-width: 100%;
  height: auto;
  border-radius: 4pt;
}
figure {
  margin: 6pt 0;
}
figcaption {
  font-size: 8pt;
  color: #64748b;
  margin-top: 2pt;
}

/* ─── 16:9 Handout specifics ─── */
.paper-16-9 .slide {
  min-height: ${PAPER_16_9.contentHeightMm * 0.85}mm;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.paper-16-9 .slide-content h2 { font-size: 16pt; }
.paper-16-9 .slide-content .body-text { font-size: 12pt; }
.paper-16-9 .activity-box { font-size: 11pt; }
.paper-16-9 .slide { break-after: page; page-break-after: always; }

/* ─── Screen preview ─── */
@media screen {
  body { padding: 20px; max-width: 900px; }
  .slide { box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
}

/* ─── Print overrides ─── */
@media print {
  body { background: #fff; max-width: none; }
  .slide { border-color: #d1d5db; box-shadow: none; }
  a { color: inherit; text-decoration: none; }
  .no-print { display: none !important; }
}

/* ═══ Pagination Rules ═══ */
${buildPaginationCss()}
`;
}

// ────────────────── HTML Template Generator ──────────────────

export interface PdfTemplateOptions {
  paper: PaperFormat;
  title: string;
  subtitle: string;
  slideCount: number;
  exportTarget: "teacher" | "student";
  /** ISO date string */
  generatedAt?: string;
}

/**
 * Generate the full HTML document for PDF export.
 * Slides HTML is injected via the `slidesHtml` parameter.
 */
export function generatePdfHtml(
  slidesHtml: string,
  opts: PdfTemplateOptions,
): string {
  const paper = getPaperConfig(opts.paper);
  const css = buildBaseCss(paper);
  const bodyClass = [
    opts.exportTarget === "student" ? "student-export" : "teacher-export",
    opts.paper === "16:9" ? "paper-16-9" : "paper-a4",
  ].join(" ");

  const dateStr = opts.generatedAt
    ? new Date(opts.generatedAt).toLocaleDateString("cs-CZ")
    : new Date().toLocaleDateString("cs-CZ");

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(opts.title)} – ${escHtml(opts.subtitle)}</title>
<style>${css}</style>
</head>
<body class="${bodyClass}">

<div class="doc-header">
  <div>
    <h1>${escHtml(opts.title)}</h1>
    <p class="text-muted">${escHtml(opts.subtitle)} · ${opts.slideCount} slidů</p>
  </div>
  <div class="meta">
    <div>ZEdu Export</div>
    <div>${dateStr}</div>
  </div>
</div>

<div class="slides">
${slidesHtml}
</div>

<div class="doc-footer">
  ZEdu · ${escHtml(opts.title)} · ${dateStr} · Strana <span class="page-num"></span>
</div>

</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ────────────────── Exported spec for JSON consumption ──────────────────

export const PDF_EXPORT_SPEC = {
  htmlTemplate: "generatePdfHtml() — builds full <!DOCTYPE html> document with @page rules, system fonts, print-friendly contrast",
  css: {
    pageRules: "@page { size: A4 portrait | 254mm 143mm landscape; margin: 18mm 16mm 20mm 16mm }",
    fonts: "system-ui stack (Segoe UI, -apple-system, Helvetica Neue, Arial) — no CDN dependency",
    contrast: "body #1e293b on #fff, muted #475569, headings #0f172a — AAA print contrast",
    activityBox: "border + #fefce8 background — visually distinct even in grayscale",
    a4Layout: "portrait, max-width 178mm content area, slide cards with border-radius",
    handout16_9: "landscape, min-height per slide, break-after:page per slide, larger fonts",
  },
  paginationRules: PAGINATION_RULES.map(r => `${r.id}: ${r.description}`),
} as const;

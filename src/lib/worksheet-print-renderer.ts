/**
 * Worksheet Print Renderer — converts WorksheetSpec → print-ready HTML + CSS.
 *
 * Features:
 *   - A4 portrait, system fonts only (no CDN)
 *   - break-inside:avoid on every item block
 *   - Dedicated answer spaces (lines, grid, blank)
 *   - Header with optional name / date / class fields
 *   - Separate answer key page
 *   - AAA print contrast
 */

import type {
  WorksheetSpec,
  WorksheetVariant,
  WorksheetItem,
  AnswerKeyEntry,
  AnswerSpace,
} from "./worksheet-spec";

// ────────────────── Pagination Rules ──────────────────

export const WORKSHEET_PAGINATION_RULES = [
  "break-inside:avoid on .ws-item — never split a question across pages",
  "break-after:avoid on .ws-item-prompt — keep prompt with answer space",
  "orphans:2; widows:2 on paragraphs — no lonely lines",
  "break-before:page on .ws-answer-key — answer key starts on new page",
  "break-inside:avoid on .ws-matching-table — matching table stays whole",
  "break-inside:avoid on .ws-ordering-list — ordering list stays whole",
  "break-after:avoid on h2, h3 — headings stay with following content",
] as const;

// ────────────────── CSS ──────────────────

export function buildWorksheetCss(): string {
  return `
/* ═══ ZEdu Worksheet Print — A4 ═══ */

@page {
  size: A4 portrait;
  margin: 18mm 16mm 22mm 16mm;
  @bottom-center {
    content: counter(page) " / " counter(pages);
    font-size: 7.5pt;
    color: #94a3b8;
    font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  }
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

body {
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.5;
  color: #1e293b;
  background: #fff;
  max-width: 178mm;
  margin: 0 auto;
}

/* ─── Header ─── */
.ws-header {
  border-bottom: 2pt solid #0f172a;
  padding-bottom: 8pt;
  margin-bottom: 14pt;
}
.ws-header-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6pt;
}
.ws-title { font-size: 16pt; font-weight: 700; color: #0f172a; line-height: 1.2; }
.ws-subtitle { font-size: 10pt; color: #475569; margin-top: 2pt; }
.ws-variant-badge {
  display: inline-block;
  padding: 2pt 10pt;
  border: 1.5pt solid #0f172a;
  border-radius: 3pt;
  font-size: 10pt;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}
.ws-meta-row {
  display: flex;
  gap: 6pt;
  font-size: 9pt;
  color: #64748b;
  flex-wrap: wrap;
}
.ws-meta-tag {
  padding: 1pt 6pt;
  background: #f1f5f9;
  border-radius: 2pt;
  font-weight: 600;
}
.ws-fields {
  display: flex;
  gap: 12pt;
  margin-top: 8pt;
}
.ws-field {
  display: flex;
  align-items: baseline;
  gap: 4pt;
  font-size: 10pt;
}
.ws-field-label {
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
}
.ws-field-line {
  display: inline-block;
  min-width: 100pt;
  border-bottom: 1pt solid #1e293b;
}
.ws-instructions {
  margin-top: 8pt;
  padding: 6pt 10pt;
  background: #f8fafc;
  border-left: 3pt solid #64748b;
  font-size: 9pt;
  color: #475569;
  line-height: 1.5;
}

/* ─── Items ─── */
.ws-item {
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 12pt;
  padding: 8pt 10pt;
  border: 0.5pt solid #e2e8f0;
  border-radius: 4pt;
  background: #fff;
}
.ws-item-header {
  display: flex;
  align-items: baseline;
  gap: 6pt;
  margin-bottom: 4pt;
}
.ws-item-number {
  font-size: 11pt;
  font-weight: 700;
  color: #0f172a;
  min-width: 18pt;
}
.ws-item-points {
  margin-left: auto;
  font-size: 8pt;
  color: #94a3b8;
  font-weight: 600;
  white-space: nowrap;
}
.ws-item-prompt {
  font-size: 10.5pt;
  line-height: 1.5;
  color: #1e293b;
  margin-bottom: 6pt;
  break-after: avoid;
  page-break-after: avoid;
}

/* ─── MCQ ─── */
.ws-choices {
  list-style: none;
  padding: 0;
  margin: 4pt 0;
}
.ws-choices li {
  display: flex;
  align-items: flex-start;
  gap: 6pt;
  padding: 2pt 0;
  font-size: 10pt;
}
.ws-choice-marker {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16pt;
  height: 16pt;
  border: 1pt solid #94a3b8;
  border-radius: 50%;
  font-size: 8pt;
  font-weight: 600;
  color: #64748b;
  flex-shrink: 0;
  margin-top: 1pt;
}

/* ─── True/False ─── */
.ws-tf-options {
  display: flex;
  gap: 16pt;
  margin: 4pt 0;
}
.ws-tf-option {
  display: flex;
  align-items: center;
  gap: 4pt;
  font-size: 10pt;
}
.ws-tf-box {
  width: 14pt;
  height: 14pt;
  border: 1pt solid #64748b;
  border-radius: 2pt;
}

/* ─── Fill blanks ─── */
.ws-blank-text {
  font-size: 10.5pt;
  line-height: 2;
  color: #1e293b;
}
.ws-blank-slot {
  display: inline-block;
  min-width: 60pt;
  border-bottom: 1.5pt solid #1e293b;
  margin: 0 3pt;
}

/* ─── Matching ─── */
.ws-matching-table {
  width: 100%;
  border-collapse: collapse;
  margin: 4pt 0;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-matching-table th {
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
  font-weight: 600;
  text-align: left;
  padding: 2pt 8pt 4pt;
  border-bottom: 1pt solid #cbd5e1;
}
.ws-matching-table td {
  padding: 4pt 8pt;
  font-size: 10pt;
  border-bottom: 0.5pt solid #e2e8f0;
  vertical-align: top;
}
.ws-matching-table td.ws-match-answer {
  border-bottom: 1pt dotted #94a3b8;
  min-width: 80pt;
}

/* ─── Ordering ─── */
.ws-ordering-list {
  list-style: none;
  padding: 0;
  margin: 4pt 0;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-ordering-list li {
  display: flex;
  align-items: center;
  gap: 8pt;
  padding: 3pt 0;
  font-size: 10pt;
  border-bottom: 0.5pt solid #e2e8f0;
}
.ws-order-box {
  width: 20pt;
  height: 18pt;
  border: 1pt solid #64748b;
  border-radius: 2pt;
  flex-shrink: 0;
}

/* ─── Answer Space ─── */
.ws-answer-space {
  margin-top: 6pt;
  position: relative;
}
.ws-answer-lines {
  width: 100%;
}
.ws-answer-line {
  height: 0;
  border-bottom: 0.5pt solid #cbd5e1;
  margin-bottom: 6mm;
}
.ws-answer-grid {
  border: 0.5pt solid #e2e8f0;
  border-radius: 3pt;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 5mm, #e2e8f0 5mm, #e2e8f0 5.2mm),
    repeating-linear-gradient(90deg, transparent, transparent 5mm, #e2e8f0 5mm, #e2e8f0 5.2mm);
  background-size: 5.2mm 5.2mm;
}
.ws-answer-blank {
  border: 1pt dashed #cbd5e1;
  border-radius: 3pt;
  position: relative;
}
.ws-answer-blank::after {
  content: "Místo pro odpověď";
  position: absolute;
  top: 3pt;
  left: 6pt;
  font-size: 7pt;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ─── Answer Key ─── */
.ws-answer-key {
  break-before: page;
  page-break-before: always;
  padding-top: 10pt;
}
.ws-answer-key h2 {
  font-size: 14pt;
  font-weight: 700;
  color: #0f172a;
  border-bottom: 1.5pt solid #0f172a;
  padding-bottom: 4pt;
  margin-bottom: 10pt;
}
.ws-key-item {
  display: flex;
  gap: 8pt;
  padding: 3pt 0;
  font-size: 10pt;
  border-bottom: 0.5pt solid #f1f5f9;
}
.ws-key-num { font-weight: 700; min-width: 18pt; color: #0f172a; }
.ws-key-answer { color: #15803d; font-weight: 600; }
.ws-key-explanation { color: #64748b; font-size: 9pt; margin-top: 1pt; }

/* ─── Footer ─── */
.ws-footer {
  margin-top: 16pt;
  padding-top: 4pt;
  border-top: 0.5pt solid #e2e8f0;
  font-size: 7pt;
  color: #94a3b8;
  text-align: center;
}

/* ─── Pagination ─── */
h2, h3 { break-after: avoid; page-break-after: avoid; }
p, li { orphans: 2; widows: 2; }

/* ─── Screen preview ─── */
@media screen {
  body { padding: 20px; max-width: 800px; }
  .ws-item { box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
}

/* ─── Print overrides ─── */
@media print {
  body { background: #fff; max-width: none; }
  a { color: inherit; text-decoration: none; }
  .no-print { display: none !important; }
}
`;
}

// ────────────────── HTML Builders ──────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderHeader(spec: WorksheetSpec, variant: WorksheetVariant): string {
  const h = spec.header;
  const meta = spec.metadata;

  const fields: string[] = [];
  if (h.studentNameField) {
    fields.push(`<div class="ws-field"><span class="ws-field-label">Jméno:</span><span class="ws-field-line">&nbsp;</span></div>`);
  }
  if (h.dateField) {
    fields.push(`<div class="ws-field"><span class="ws-field-label">Datum:</span><span class="ws-field-line">&nbsp;</span></div>`);
  }
  if (h.classField) {
    fields.push(`<div class="ws-field"><span class="ws-field-label">Třída:</span><span class="ws-field-line">&nbsp;</span></div>`);
  }

  const variantBadge = h.variantLabel
    ? `<span class="ws-variant-badge">${esc(h.variantLabel)}</span>`
    : "";

  const metaTags: string[] = [
    `<span class="ws-meta-tag">${esc(h.subject)}</span>`,
    `<span class="ws-meta-tag">${esc(h.gradeBand)}</span>`,
    `<span class="ws-meta-tag">${meta.totalPoints} bodů</span>`,
    `<span class="ws-meta-tag">~${meta.totalTimeMin} min</span>`,
  ];
  if (h.teacherName) {
    metaTags.push(`<span class="ws-meta-tag">${esc(h.teacherName)}</span>`);
  }

  return `
<div class="ws-header">
  <div class="ws-header-top">
    <div>
      <div class="ws-title">${esc(h.title)}</div>
      ${h.subtitle ? `<div class="ws-subtitle">${esc(h.subtitle)}</div>` : ""}
    </div>
    ${variantBadge}
  </div>
  <div class="ws-meta-row">${metaTags.join("")}</div>
  ${fields.length ? `<div class="ws-fields">${fields.join("")}</div>` : ""}
  ${h.instructions ? `<div class="ws-instructions">${esc(h.instructions)}</div>` : ""}
</div>`;
}

function renderAnswerSpace(space: AnswerSpace): string {
  if (space.type === "none" || space.heightMm <= 0) return "";

  const hStyle = `height:${space.heightMm}mm`;

  switch (space.type) {
    case "lines": {
      const count = space.lineCount ?? Math.max(2, Math.floor(space.heightMm / 7));
      const lines = Array.from({ length: count }, () => `<div class="ws-answer-line"></div>`).join("");
      return `<div class="ws-answer-space ws-answer-lines" style="${hStyle}">${lines}</div>`;
    }
    case "grid":
      return `<div class="ws-answer-space ws-answer-grid" style="${hStyle}"></div>`;
    case "blank":
      return `<div class="ws-answer-space ws-answer-blank" style="${hStyle}"></div>`;
    default:
      return "";
  }
}

const CHOICE_LETTERS = "ABCDEFGHIJKLMNOP";

function renderItem(item: WorksheetItem, showPoints: boolean): string {
  const pointsHtml = showPoints
    ? `<span class="ws-item-points">[${item.points} ${item.points === 1 ? "bod" : item.points < 5 ? "body" : "bodů"}]</span>`
    : "";

  let body = "";

  switch (item.type) {
    case "mcq":
      body = `<ul class="ws-choices">${(item.choices ?? [])
        .map((c, i) => `<li><span class="ws-choice-marker">${CHOICE_LETTERS[i]}</span><span>${esc(c)}</span></li>`)
        .join("")}</ul>`;
      break;

    case "true_false":
      body = `<div class="ws-tf-options">
        <label class="ws-tf-option"><span class="ws-tf-box"></span> Pravda</label>
        <label class="ws-tf-option"><span class="ws-tf-box"></span> Nepravda</label>
      </div>`;
      break;

    case "fill_blank":
      if (item.blankText) {
        body = `<div class="ws-blank-text">${esc(item.blankText).replace(/___/g, '<span class="ws-blank-slot">&nbsp;</span>')}</div>`;
      }
      break;

    case "matching":
      if (item.matchPairs?.length) {
        const rows = item.matchPairs
          .map((p, i) => `<tr><td>${i + 1}. ${esc(p.left)}</td><td class="ws-match-answer">&nbsp;</td><td>${esc(p.right)}</td></tr>`)
          .join("");
        body = `<table class="ws-matching-table">
          <thead><tr><th>Pojem</th><th>Odpověď</th><th>Definice</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
      }
      break;

    case "ordering":
      if (item.orderItems?.length) {
        const lis = item.orderItems
          .map((o) => `<li><span class="ws-order-box"></span><span>${esc(o)}</span></li>`)
          .join("");
        body = `<ul class="ws-ordering-list">${lis}</ul>`;
      }
      break;

    case "short_answer":
    case "open_answer":
      // prompt + answer space only
      break;

    case "offline_activity": {
      const modeLabels: Record<string, string> = {
        discussion: "Diskuse",
        group_work: "Skupinová práce",
        practical: "Praktická aktivita",
        observation: "Pozorování",
        reflection: "Reflexe",
      };
      const groupLabels: Record<string, string> = {
        individual: "Jednotlivec",
        pair: "Dvojice",
        small_group: "Malá skupina (3–5)",
        class: "Celá třída",
      };
      const mode = item.offlineMode ?? "discussion";
      const group = item.groupSize ?? "class";
      const dur = item.durationMin && item.durationMin > 0 ? `~${item.durationMin} min` : "";
      body = `<div class="ws-offline-activity">
        <div class="ws-offline-badge">⬢ Offline aktivita: ${esc(modeLabels[mode] ?? mode)}</div>
        <div class="ws-offline-meta">
          <span>👥 ${esc(groupLabels[group] ?? group)}</span>
          ${dur ? `<span>⏱ ${esc(dur)}</span>` : ""}
        </div>
      </div>`;
      break;
    }
  }

  return `
<div class="ws-item">
  <div class="ws-item-header">
    <span class="ws-item-number">${item.itemNumber}.</span>
    ${pointsHtml}
  </div>
  <div class="ws-item-prompt">${esc(item.prompt)}</div>
  ${body}
  ${renderAnswerSpace(item.answerSpace)}
</div>`;
}

function renderAnswerKey(variantId: string, keys: AnswerKeyEntry[]): string {
  if (!keys?.length) return "";

  const rows = keys
    .map((k) => {
      const ans = Array.isArray(k.correctAnswer) ? k.correctAnswer.join(", ") : k.correctAnswer;
      return `
<div class="ws-key-item">
  <span class="ws-key-num">${k.itemNumber}.</span>
  <div>
    <span class="ws-key-answer">${esc(ans)}</span>
    ${k.explanation ? `<div class="ws-key-explanation">${esc(k.explanation)}</div>` : ""}
  </div>
</div>`;
    })
    .join("");

  return `
<div class="ws-answer-key">
  <h2>Klíč odpovědí — Varianta ${esc(variantId)}</h2>
  ${rows}
</div>`;
}

// ────────────────── Main Renderer ──────────────────

export interface WorksheetPrintOptions {
  paper?: "A4";
  includeNameField?: boolean;
}

/**
 * Render a single variant of WorksheetSpec to a complete HTML document for print.
 */
export function renderWorksheetVariantHtml(
  spec: WorksheetSpec,
  variantId: string,
  options?: WorksheetPrintOptions,
): string {
  const variant = spec.variants.find((v) => v.variantId === variantId);
  if (!variant) throw new Error(`Variant "${variantId}" not found`);

  // Override name field if requested
  const specCopy: WorksheetSpec = options?.includeNameField !== undefined
    ? { ...spec, header: { ...spec.header, studentNameField: options.includeNameField } }
    : spec;

  const css = buildWorksheetCss();
  const header = renderHeader(specCopy, variant);
  const items = variant.items.map((it) => renderItem(it, specCopy.renderConfig.showPoints)).join("\n");
  const answerKey = specCopy.renderConfig.includeAnswerKey
    ? renderAnswerKey(variantId, spec.answerKeys[variantId] ?? [])
    : "";

  const dateStr = new Date().toLocaleDateString("cs-CZ");

  return `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(specCopy.header.title)}${specCopy.header.variantLabel ? ` — ${esc(specCopy.header.variantLabel)}` : ""}</title>
<style>${css}</style>
</head>
<body>

${header}

<div class="ws-items">
${items}
</div>

${answerKey}

<div class="ws-footer">
  ZEdu · ${esc(specCopy.header.title)} · ${dateStr}
</div>

</body>
</html>`;
}

/**
 * Render ALL variants into separate HTML documents.
 */
export function renderAllVariants(
  spec: WorksheetSpec,
  options?: WorksheetPrintOptions,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const v of spec.variants) {
    result[v.variantId] = renderWorksheetVariantHtml(spec, v.variantId, options);
  }
  return result;
}

// ────────────────── Exported Spec for JSON consumption ──────────────────

export const WORKSHEET_PRINT_SPEC = {
  printCss: "buildWorksheetCss() — @page A4, system fonts, break-inside:avoid per item, AAA contrast",
  printHtml: "renderWorksheetVariantHtml() — full <!DOCTYPE html> with header, items, answer spaces, optional answer key",
  paginationRules: [...WORKSHEET_PAGINATION_RULES],
  paperConfig: {
    format: "A4",
    widthMm: 210,
    heightMm: 297,
    orientation: "portrait",
    marginMm: { top: 18, right: 16, bottom: 22, left: 16 },
    contentWidthMm: 178,
  },
  fonts: "system-ui (Segoe UI, -apple-system, Helvetica Neue, Arial) — no CDN",
  contrast: "body #1e293b on #fff, headings #0f172a, muted #475569 — AAA print",
} as const;

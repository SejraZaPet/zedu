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
/* ═══ ZEdu Worksheet Print — Workbook / Study Material ═══ */

@page {
  size: A4 portrait;
  margin: 14mm 14mm 16mm 14mm;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  margin: 0;
  padding: 0;
  background: #FFFFFF;
}

.ws-page,
.ws-content {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif;
  font-size: 10.5pt;
  line-height: 1.5;
  color: #1A1A1A !important;
  background: #FFFFFF !important;
}

.ws-page {
  display: block;
  width: 100%;
  min-height: 297mm;
  background: #FFFFFF !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.ws-page,
.ws-page *,
.ws-page *::before,
.ws-page *::after {
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  opacity: 1 !important;
  visibility: visible !important;
}

.ws-content {
  display: block;
  width: 100%;
  min-height: 273mm;
  padding: 0;
  overflow: visible;
}

.ws-items { display: block; width: 100%; }

/* ─── Header ─── */
.ws-header {
  display: block;
  margin-bottom: 12mm;
  padding-bottom: 8mm;
  border-bottom: 1.5pt solid #1A1A1A;
}
.ws-header-top {
  display: table;
  width: 100%;
  margin-bottom: 8pt;
}
.ws-title-block {
  display: table-cell;
  vertical-align: top;
  width: 75%;
  padding-right: 12pt;
}
.ws-eyebrow {
  display: block;
  font-size: 8.5pt;
  font-weight: 600;
  color: #64748B !important;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 6pt;
}
.ws-title {
  display: block;
  font-size: 26pt;
  font-weight: 700;
  color: #1A1A1A !important;
  line-height: 1.1;
  margin: 0 0 6pt 0;
  letter-spacing: -0.01em;
}
.ws-subtitle {
  display: block;
  font-size: 10pt;
  font-weight: 600;
  color: #64748B !important;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 4pt;
}
.ws-qr-wrap {
  display: table-cell;
  vertical-align: top;
  text-align: right;
  width: 25%;
}
.ws-qr-wrap img {
  display: inline-block;
  width: 78pt;
  height: 78pt;
  border: 1pt solid #E5E7EB;
  border-radius: 4pt;
  padding: 2pt;
  background: #FFFFFF !important;
}
.ws-qr-wrap > div:last-child {
  display: block;
  margin-top: 4pt;
  font-size: 7pt;
  color: #64748B !important;
  line-height: 1.3;
  max-width: 100pt;
  text-align: right;
}

/* ─── Student fields ─── */
.ws-fields-strip {
  display: block;
  margin: 8pt 0 0 0;
  padding-top: 8pt;
  border-top: 0.5pt solid #E5E7EB;
}
.ws-field {
  display: inline-block;
  margin-right: 32pt;
  font-size: 10pt;
  color: #64748B !important;
  white-space: nowrap;
}
.ws-field-label {
  display: inline-block;
  margin-right: 6pt;
  font-weight: 600;
  color: #1A1A1A !important;
}
.ws-field-line {
  display: inline-block;
  min-width: 130pt;
  border-bottom: 1pt solid #1A1A1A;
  height: 14pt;
  vertical-align: bottom;
}

/* ─── Instructions ─── */
.ws-instructions {
  display: block;
  margin: 8mm 0 6mm 0;
  padding: 6pt 0 6pt 12pt;
  border-left: 2pt solid #7C3AED;
  font-size: 10pt;
  color: #475569 !important;
  font-style: italic;
  line-height: 1.6;
}

/* ─── Items ─── */
.ws-item {
  display: block;
  break-inside: avoid;
  page-break-inside: avoid;
  margin-bottom: 10mm;
  background: #FFFFFF !important;
  color: #1A1A1A !important;
  overflow: visible;
}
.ws-item-header {
  display: block;
  margin-bottom: 6pt;
  padding-bottom: 4pt;
}
.ws-item-num {
  display: inline-block;
  width: 18pt;
  font-size: 14pt;
  font-weight: 700;
  color: #7C3AED !important;
  vertical-align: top;
  line-height: 1.3;
}
.ws-item-prompt,
.ws-item .prompt {
  display: inline;
  font-size: 12pt;
  font-weight: 600;
  color: #1A1A1A !important;
  background: transparent !important;
  line-height: 1.4;
  break-after: avoid;
  page-break-after: avoid;
}
.ws-item-points {
  display: inline-block;
  float: right;
  margin-top: 4pt;
  font-size: 8.5pt;
  color: #94A3B8 !important;
  font-weight: 500;
}

/* ─── MCQ ─── */
.ws-choices {
  list-style: none;
  padding: 0;
  margin: 6pt 0 6pt 18pt;
}
.ws-choices li {
  display: block;
  padding: 5pt 0 5pt 32pt;
  position: relative;
  font-size: 11pt;
  line-height: 1.5;
  color: #1A1A1A !important;
}
.ws-choice-marker {
  display: inline-block;
  position: absolute;
  left: 0;
  top: 5pt;
  width: 22pt;
  height: 22pt;
  line-height: 19pt;
  text-align: center;
  border: 1.5pt solid #1A1A1A;
  border-radius: 50%;
  font-size: 10pt;
  font-weight: 700;
  color: #1A1A1A !important;
  background: #FFFFFF !important;
}

/* ─── True/False ─── */
.ws-tf-options {
  display: block;
  margin: 8pt 0 0 18pt;
}
.ws-tf-option {
  display: inline-block;
  margin-right: 32pt;
  font-size: 11pt;
  color: #1A1A1A !important;
  vertical-align: middle;
}
.ws-tf-box {
  display: inline-block;
  width: 14pt;
  height: 14pt;
  border: 1.5pt solid #1A1A1A;
  border-radius: 2pt;
  background: #FFFFFF !important;
  margin-right: 6pt;
  vertical-align: middle;
}

/* ─── Fill blanks ─── */
.ws-blank-text {
  display: block;
  margin: 6pt 0 0 18pt;
  font-size: 11pt;
  line-height: 2.2;
  color: #1A1A1A !important;
}
.ws-blank-slot {
  display: inline-block;
  min-width: 90pt;
  border-bottom: 1.5pt solid #1A1A1A;
  margin: 0 4pt;
  height: 16pt;
  vertical-align: bottom;
}

/* ─── Offline activity ─── */
.ws-offline-activity {
  display: block;
  margin: 6pt 0 0 18pt;
  padding: 8pt 0 8pt 12pt;
  border-left: 2pt solid #94A3B8;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-offline-badge {
  display: block;
  font-size: 9pt;
  font-weight: 700;
  color: #475569 !important;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin-bottom: 4pt;
}
.ws-offline-meta {
  display: block;
  font-size: 9.5pt;
  color: #475569 !important;
}
.ws-offline-meta > span {
  display: inline-block;
  margin-right: 18pt;
}

/* ─── Matching ─── */
.ws-matching-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0 4pt;
  margin: 6pt 0 0 18pt;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-matching-table th {
  font-size: 8pt;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748B !important;
  font-weight: 600;
  text-align: left;
  padding: 2pt 10pt 4pt;
}
.ws-matching-table td {
  padding: 6pt 10pt;
  font-size: 10pt;
  background: #FFFFFF !important;
  border-bottom: 0.5pt solid #E5E7EB;
  vertical-align: middle;
  color: #1A1A1A !important;
}
.ws-matching-table td.ws-match-answer {
  background: #FFFFFF !important;
  border-bottom: 1pt solid #1A1A1A;
  min-width: 100pt;
}

/* ─── Ordering ─── */
.ws-ordering-list {
  list-style: none;
  padding: 0;
  margin: 6pt 0 0 18pt;
  break-inside: avoid;
  page-break-inside: avoid;
}
.ws-ordering-list li {
  display: block;
  padding: 8pt 0 8pt 36pt;
  font-size: 11pt;
  position: relative;
  border-bottom: 0.5pt solid #E5E7EB;
  color: #1A1A1A !important;
}
.ws-order-box {
  display: inline-block;
  position: absolute;
  left: 0;
  top: 6pt;
  width: 24pt;
  height: 22pt;
  border: 1.5pt solid #1A1A1A;
  border-radius: 2pt;
  background: #FFFFFF !important;
}

/* ─── Answer Space ─── */
.ws-answer-space {
  display: block;
  margin: 8pt 0 0 18pt;
  position: relative;
}
.ws-answer-lines { display: block; width: 100%; }
.ws-answer-line {
  display: block;
  height: 8mm;
  border-bottom: 0.7pt solid #94A3B8;
  margin: 0;
}
.ws-answer-grid {
  display: block;
  border: 0.7pt solid #E5E7EB;
  border-radius: 0;
  background: #FFFFFF !important;
}
.ws-answer-blank {
  display: block;
  border: 0.7pt dashed #94A3B8;
  background: #FAFAFA !important;
  position: relative;
  padding: 12pt;
}
.ws-answer-label {
  position: absolute;
  top: 4pt;
  right: 8pt;
  font-size: 7pt;
  color: #94A3B8 !important;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ─── Answer Key ─── */
.ws-answer-key {
  break-before: page;
  page-break-before: always;
  padding-top: 8pt;
}
.ws-answer-key h2 {
  font-size: 18pt;
  font-weight: 700;
  color: #1A1A1A !important;
  border-bottom: 1.5pt solid #1A1A1A;
  padding-bottom: 6pt;
  margin-bottom: 12pt;
  letter-spacing: -0.01em;
}
.ws-key-item {
  display: block;
  padding: 8pt 0;
  margin-bottom: 0;
  border-bottom: 0.5pt solid #E5E7EB;
  background: #FFFFFF !important;
}
.ws-key-num {
  display: inline-block;
  width: 24pt;
  font-weight: 700;
  color: #7C3AED !important;
  font-size: 11pt;
  vertical-align: top;
}
.ws-key-answer {
  display: inline;
  color: #1A1A1A !important;
  font-weight: 600;
  font-size: 11pt;
}
.ws-key-explanation {
  display: block;
  margin: 4pt 0 0 24pt;
  color: #64748B !important;
  font-size: 9.5pt;
  line-height: 1.5;
}

/* ─── Footer ─── */
.ws-footer {
  display: block;
  margin-top: 16mm;
  padding-top: 6pt;
  border-top: 0.5pt solid #E5E7EB;
  font-size: 8pt;
  color: #94A3B8 !important;
  text-align: left;
}
.ws-footer-meta {
  display: block;
  margin-top: 2pt;
}

/* ─── Pagination ─── */
h2, h3 { break-after: avoid; page-break-after: avoid; }
p, li { orphans: 2; widows: 2; }

/* ─── Screen preview ─── */
@media screen {
  .ws-page { padding: 20px; }
  .ws-content { max-width: 800px; margin: 0 auto; }
}

/* ─── Print overrides ─── */
@media print {
  .ws-page, .ws-content { background: #FFFFFF !important; }
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

function pointsLabel(n: number): string {
  if (n === 1) return "bod";
  if (n >= 2 && n <= 4) return "body";
  return "bodů";
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

  const pointsEnabled = spec.renderConfig.pointsEnabled !== false;
  const metaTags: string[] = [
    `<span class="ws-meta-tag ws-meta-primary">${esc(h.subject)}</span>`,
    `<span class="ws-meta-tag">${esc(h.gradeBand)}</span>`,
  ];
  if (pointsEnabled) {
    metaTags.push(`<span class="ws-meta-tag">${meta.totalPoints} ${pointsLabel(meta.totalPoints)}</span>`);
  }
  metaTags.push(`<span class="ws-meta-tag">~${meta.totalTimeMin} min</span>`);
  if (h.teacherName) {
    metaTags.push(`<span class="ws-meta-tag">${esc(h.teacherName)}</span>`);
  }

  return `
<div class="ws-header">
  <div class="ws-header-top">
    <div class="ws-title-block">
      <div class="ws-title">${esc(h.title)}</div>
      ${h.subtitle ? `<div class="ws-subtitle">${esc(h.subtitle)}</div>` : ""}
      ${variantBadge}
    </div>
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
      return `<div class="ws-answer-space ws-answer-blank" style="${hStyle}"><span class="ws-answer-label">Místo pro odpověď</span></div>`;
    default:
      return "";
  }
}

const CHOICE_LETTERS = "ABCDEFGHIJKLMNOP";

function renderItem(item: WorksheetItem, showPoints: boolean): string {
  const pointsHtml = showPoints
    ? `<span class="ws-item-points">${item.points} ${pointsLabel(item.points)}</span>`
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
        <div class="ws-offline-badge">Aktivita ve třídě · ${esc(modeLabels[mode] ?? mode)}</div>
        <div class="ws-offline-meta">
          <span><strong>Skupina:</strong> ${esc(groupLabels[group] ?? group)}</span>
          ${dur ? `<span><strong>Čas:</strong> ${esc(dur)}</span>` : ""}
        </div>
      </div>`;
      break;
    }
  }

  const typeLabels: Record<string, string> = {
    mcq: "Výběr z možností",
    true_false: "Pravda / Nepravda",
    fill_blank: "Doplňování",
    matching: "Spojování",
    ordering: "Seřazení",
    short_answer: "Krátká odpověď",
    open_answer: "Otevřená odpověď",
    offline_activity: "Aktivita ve třídě",
  };

  return `
<div class="ws-item">
  <div class="ws-item-header">
    <span class="ws-item-number-badge">${item.itemNumber}</span>
    <span class="ws-item-type">${esc(typeLabels[item.type] ?? item.type)}</span>
    ${pointsHtml}
  </div>
  <div class="ws-item-prompt prompt">${esc(item.prompt)}</div>
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
  const showPointsEffective = specCopy.renderConfig.showPoints && specCopy.renderConfig.pointsEnabled !== false;
  const items = variant.items.map((it) => renderItem(it, showPointsEffective)).join("\n");
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

<div class="ws-page">
  <div class="ws-content">
${header}

<div class="ws-items">
${items}
</div>

${answerKey}

<div class="ws-footer">
  ZEdu · ${esc(specCopy.header.title)} · ${dateStr}
</div>
  </div>
</div>

</body>
</html>`;
}

/**
 * Render variant content as a fragment (no <html>/<head>/<body>).
 * Returns separate styleTag + bodyHtml so it can be injected safely
 * into an existing DOM node (e.g. a div for html2canvas/html2pdf).
 */
export function renderWorksheetVariantFragment(
  spec: WorksheetSpec,
  variantId: string,
  options?: WorksheetPrintOptions,
): { styleTag: string; bodyHtml: string; documentTitle: string } {
  const variant = spec.variants.find((v) => v.variantId === variantId);
  if (!variant) throw new Error(`Variant "${variantId}" not found`);

  const specCopy: WorksheetSpec = options?.includeNameField !== undefined
    ? { ...spec, header: { ...spec.header, studentNameField: options.includeNameField } }
    : spec;

  const css = buildWorksheetCss();
  const header = renderHeader(specCopy, variant);
  const showPointsEffective = specCopy.renderConfig.showPoints && specCopy.renderConfig.pointsEnabled !== false;
  const items = variant.items
    .map((it) => renderItem(it, showPointsEffective))
    .join("\n");
  const answerKey = specCopy.renderConfig.includeAnswerKey
    ? renderAnswerKey(variantId, spec.answerKeys[variantId] ?? [])
    : "";

  const dateStr = new Date().toLocaleDateString("cs-CZ");

  const bodyHtml = `
<div class="ws-page">
  <div class="ws-content">
${header}

<div class="ws-items">
${items}
</div>

${answerKey}

<div class="ws-footer">
  ZEdu · ${esc(specCopy.header.title)} · ${dateStr}
</div>
  </div>
</div>`;

  return {
    styleTag: `<style>${css}</style>`,
    bodyHtml,
    documentTitle: `${esc(specCopy.header.title)}${specCopy.header.variantLabel ? ` — ${esc(specCopy.header.variantLabel)}` : ""}`,
  };
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

/**
 * Export plánu hodiny do PDF přes window.print().
 * Tři šablony: short | detailed | student.
 */

export type LessonPlanTemplate = "short" | "detailed" | "student";

export interface LessonPlanPhaseInput {
  key: string;
  title: string;
  timeMin: string | number;
  description: string;
  activities?: { kind?: string; title: string }[];
}

export interface LessonPlanExportData {
  title: string;
  subject?: string;
  className?: string;
  date?: string; // YYYY-MM-DD
  start?: string;
  end?: string;
  description?: string;
  phases: LessonPlanPhaseInput[];
}

const TEMPLATE_LABEL: Record<LessonPlanTemplate, string> = {
  short: "Krátký plán",
  detailed: "Detailní plán (hospitace)",
  student: "Studentský plán",
};

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDateCs(iso?: string): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("cs-CZ", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function timeRange(start?: string, end?: string): string {
  if (!start && !end) return "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "";
}

function activitiesList(phase: LessonPlanPhaseInput): string {
  const acts = (phase.activities ?? []).filter((a) => (a.title ?? "").trim());
  if (acts.length === 0) return "";
  return `<ul class="acts">${acts
    .map((a) => `<li>${escapeHtml(a.title)}</li>`)
    .join("")}</ul>`;
}

function renderShort(data: LessonPlanExportData): string {
  const rows = data.phases
    .map((p, i) => {
      const time = p.timeMin ? `${p.timeMin} min` : "—";
      const desc = (p.description ?? "").trim();
      return `
        <tr>
          <td class="num">${i + 1}.</td>
          <td class="phase">${escapeHtml(p.title)}</td>
          <td class="time">${escapeHtml(time)}</td>
          <td class="acts-cell">
            ${desc ? `<div>${escapeHtml(desc)}</div>` : ""}
            ${activitiesList(p)}
          </td>
        </tr>`;
    })
    .join("");

  return `
    <table class="phases">
      <thead>
        <tr>
          <th class="num">#</th>
          <th>Fáze</th>
          <th class="time">Čas</th>
          <th>Aktivity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderDetailed(data: LessonPlanExportData): string {
  const blocks = data.phases
    .map((p, i) => {
      const time = p.timeMin ? `${p.timeMin} min` : "—";
      const desc = (p.description ?? "").trim();
      return `
        <section class="phase-block">
          <header class="phase-head">
            <div class="phase-title">${i + 1}. ${escapeHtml(p.title)}</div>
            <div class="phase-time">${escapeHtml(time)}</div>
          </header>
          <div class="phase-grid">
            <div class="cell">
              <div class="cell-label">Aktivity / průběh</div>
              <div class="cell-content">
                ${desc ? `<div>${escapeHtml(desc)}</div>` : `<div class="muted">—</div>`}
                ${activitiesList(p)}
              </div>
            </div>
            <div class="cell">
              <div class="cell-label">Cíle fáze</div>
              <div class="cell-content lines"></div>
            </div>
            <div class="cell">
              <div class="cell-label">Rozvíjené kompetence</div>
              <div class="cell-content lines"></div>
            </div>
            <div class="cell">
              <div class="cell-label">Pomůcky</div>
              <div class="cell-content lines"></div>
            </div>
            <div class="cell">
              <div class="cell-label">Forma práce</div>
              <div class="cell-content lines"></div>
            </div>
            <div class="cell">
              <div class="cell-label">Poznámky pro hospitaci</div>
              <div class="cell-content lines"></div>
            </div>
          </div>
        </section>`;
    })
    .join("");

  const overall = data.description?.trim()
    ? `<section class="overview"><h2>Cíle hodiny / popis</h2><p>${escapeHtml(
        data.description!,
      )}</p></section>`
    : `<section class="overview">
        <h2>Cíle hodiny</h2>
        <div class="lines big"></div>
      </section>`;

  return `${overall}${blocks}`;
}

function renderStudent(data: LessonPlanExportData): string {
  const items = data.phases
    .map((p, i) => {
      const acts = (p.activities ?? [])
        .map((a) => (a.title ?? "").trim())
        .filter(Boolean);
      const mainLine = acts.length > 0 ? acts.join(" • ") : "";
      return `
        <li>
          <div class="s-title">${i + 1}. ${escapeHtml(p.title)}</div>
          ${mainLine ? `<div class="s-acts">${escapeHtml(mainLine)}</div>` : ""}
        </li>`;
    })
    .join("");

  return `
    <h2 class="s-heading">Co budeme dnes dělat</h2>
    <ol class="s-list">${items}</ol>`;
}

function buildHtml(template: LessonPlanTemplate, data: LessonPlanExportData): string {
  const headerMeta = `
    <div class="meta">
      <div><span class="k">Předmět:</span> ${escapeHtml(data.subject || "—")}</div>
      <div><span class="k">Třída:</span> ${escapeHtml(data.className || "—")}</div>
      <div><span class="k">Datum:</span> ${escapeHtml(formatDateCs(data.date))}</div>
      ${
        timeRange(data.start, data.end)
          ? `<div><span class="k">Čas:</span> ${escapeHtml(timeRange(data.start, data.end))}</div>`
          : ""
      }
    </div>`;

  let body = "";
  if (template === "short") body = renderShort(data);
  else if (template === "detailed") body = renderDetailed(data);
  else body = renderStudent(data);

  const isStudent = template === "student";
  const isShort = template === "short";

  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(data.title || "Plán hodiny")}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #f4f4f7; color: #1a1a1a; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
  .page {
    background: white;
    width: 210mm;
    min-height: 297mm;
    margin: 12px auto;
    padding: 16mm 14mm;
    box-shadow: 0 6px 24px rgba(0,0,0,0.08);
  }
  h1 { margin: 0 0 4px; font-size: ${isStudent ? "26pt" : "20pt"}; }
  h2 { margin: 14px 0 8px; font-size: 13pt; }
  .badge { display: inline-block; font-size: 9pt; padding: 2px 8px; border-radius: 999px; background: #eef; color: #335; margin-bottom: 8px; }
  .meta { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 16px; font-size: 10.5pt; margin: 8px 0 14px; padding: 10px 12px; background: #fafafa; border: 1px solid #ececec; border-radius: 8px; }
  .meta .k { color: #666; margin-right: 4px; }
  hr.sep { border: 0; border-top: 1px solid #e5e5e5; margin: 10px 0 12px; }

  /* Short table */
  table.phases { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-top: 6px; }
  table.phases th, table.phases td { border: 1px solid #d8d8d8; padding: 8px 10px; vertical-align: top; text-align: left; }
  table.phases th { background: #f3f3f6; font-weight: 600; }
  table.phases td.num, table.phases th.num { width: 28px; text-align: center; color: #666; }
  table.phases td.time, table.phases th.time { width: 70px; text-align: center; white-space: nowrap; }
  table.phases td.phase { font-weight: 600; width: 130px; }
  table.phases ul.acts { margin: 6px 0 0 16px; padding: 0; }
  table.phases ul.acts li { margin: 1px 0; }

  /* Detailed */
  .overview { margin-bottom: 12px; padding: 10px 12px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fafafa; }
  .overview h2 { margin: 0 0 6px; font-size: 12pt; }
  .overview p { margin: 0; font-size: 10.5pt; }
  .phase-block { border: 1px solid #d8d8d8; border-radius: 8px; padding: 10px 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .phase-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid #ececec; padding-bottom: 4px; margin-bottom: 8px; }
  .phase-title { font-size: 12pt; font-weight: 600; }
  .phase-time { font-size: 10pt; color: #555; }
  .phase-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 12px; font-size: 10pt; }
  .cell { border: 1px solid #ececec; border-radius: 6px; padding: 6px 8px; background: #fcfcfd; min-height: 56px; }
  .cell-label { font-size: 8.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 4px; }
  .cell-content ul.acts { margin: 4px 0 0 16px; padding: 0; }
  .cell-content .muted { color: #aaa; }
  .lines { background-image: repeating-linear-gradient(to bottom, transparent 0, transparent 17px, #e2e2e2 17px, #e2e2e2 18px); min-height: 54px; }
  .lines.big { min-height: 90px; }

  /* Student */
  .s-heading { font-size: 18pt; margin-top: 4px; }
  ol.s-list { padding-left: 0; list-style: none; counter-reset: none; }
  ol.s-list li { padding: 14px 18px; margin: 10px 0; border: 2px solid #e0e7ff; border-radius: 12px; background: linear-gradient(135deg, #f5f7ff, #ffffff); page-break-inside: avoid; }
  .s-title { font-size: 16pt; font-weight: 700; color: #2d3a87; }
  .s-acts { margin-top: 4px; font-size: 13pt; color: #333; }

  .footer { margin-top: 18px; font-size: 9pt; color: #888; text-align: right; }

  ${isShort ? `.page { min-height: auto; }` : ""}

  @media print {
    @page { size: A4; margin: 14mm; }
    html, body { background: white; }
    .page { box-shadow: none; margin: 0; width: auto; min-height: auto; padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:8px;right:8px;display:flex;gap:6px;z-index:10">
    <button onclick="window.print()" style="padding:6px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer;font:inherit">Tisk / PDF</button>
    <button onclick="window.close()" style="padding:6px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer;font:inherit">Zavřít</button>
  </div>
  <div class="page">
    <div class="badge">${escapeHtml(TEMPLATE_LABEL[template])}</div>
    <h1>${escapeHtml(data.title || "Plán hodiny")}</h1>
    ${headerMeta}
    <hr class="sep" />
    ${body}
    <div class="footer">Vytvořeno v Zedu • ${new Date().toLocaleDateString("cs-CZ")}</div>
  </div>
</body>
</html>`;
}

export function exportLessonPlanPdf(
  template: LessonPlanTemplate,
  data: LessonPlanExportData,
): void {
  const html = buildHtml(template, data);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) {
    throw new Error(
      "Pop-up okno bylo zablokováno. Povolte pop-upy pro tuto stránku a zkuste znovu.",
    );
  }
  w.document.open();
  w.document.write(html);
  w.document.close();

  const trigger = () => {
    setTimeout(() => {
      try {
        w.focus();
        w.print();
      } catch (e) {
        console.error("[lesson-plan PDF] print failed", e);
      }
    }, 400);
  };

  if (w.document.readyState === "complete") trigger();
  else w.onload = trigger;
}

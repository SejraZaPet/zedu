/**
 * Tisk / PDF export vybraných aktivit z lekce.
 * Používá stejný mechanismus jako export pracovních listů – vygeneruje HTML
 * dokument a otevře nativní print dialog, kde uživatel zvolí „Uložit jako PDF“.
 */

import type { Block } from "@/lib/textbook-config";
import { activityMeta, activityMinutes, activitySummary, WORK_MODE_LABELS } from "@/lib/activity-meta";

export type ActivityExportVariant = "student" | "teacher";

const esc = (v: unknown): string =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const answerLines = (n = 2): string =>
  Array.from({ length: n }, () => `<div class="line"></div>`).join("");

const ok = (text: unknown, withSolution: boolean): string =>
  withSolution ? `<strong class="ok">${esc(text)}</strong>` : esc(text);

const tokensToText = (tokens: any[], withSolution: boolean): string =>
  (Array.isArray(tokens) ? tokens : [])
    .map((t) =>
      t?.type === "blank"
        ? withSolution
          ? `<strong class="ok">${esc(t.answer)}</strong>`
          : `<span class="blank"></span>`
        : esc(t?.value ?? ""),
    )
    .join(" ");

/** Obsah jedné aktivity pro tisk. */
function renderActivityBody(p: Record<string, any>, withSolution: boolean): string {
  const type = p.activityType || "flashcards";
  switch (type) {
    case "quiz": {
      const questions = getQuizQuestions(p.quiz);
      return questions
        .map(
          (q, qi) => `
        <p class="q">${questions.length > 1 ? `${qi + 1}. ` : ""}${esc(q.question)}</p>
        <ol class="opts">${q.answers
          .map((a) => `<li>${ok(a?.text, withSolution && a?.correct === true)}</li>`)
          .join("")}</ol>
        ${withSolution && q.explanation ? `<p class="note">Vysvětlení: ${esc(q.explanation)}</p>` : ""}`,
        )
        .join("");
    }
    case "true_false": {
      const st: any[] = Array.isArray(p.trueFalse?.statements) ? p.trueFalse.statements : [];
      return `<ol class="opts">${st
        .map((s) => {
          const label = s?.isTrue === true || s?.correct === true ? "PRAVDA" : "NEPRAVDA";
          return `<li>${esc(s?.text ?? s?.statement)} — ${
            withSolution ? `<strong class="ok">${label}</strong>` : "P / N"
          }</li>`;
        })
        .join("")}</ol>`;
    }
    case "matching": {
      const left: any[] = Array.isArray(p.matching?.left) ? p.matching.left : [];
      const right: any[] = Array.isArray(p.matching?.right) ? p.matching.right : [];
      return `<table class="tbl"><thead><tr><th>A</th><th>B</th></tr></thead><tbody>${left
        .map(
          (l, i) =>
            `<tr><td>${esc(l)}</td><td>${
              withSolution ? `<strong class="ok">${esc(right[i])}</strong>` : "…………………………"
            }</td></tr>`,
        )
        .join("")}</tbody></table>
        ${withSolution ? "" : `<p class="note">Nabídka B: ${right.map((r) => esc(r)).join(" · ")}</p>`}`;
    }
    case "ordering": {
      const items: any[] = Array.isArray(p.ordering?.items) ? p.ordering.items : [];
      const shown = withSolution ? items : [...items].sort((a, b) => String(a).localeCompare(String(b), "cs"));
      return `<ol class="opts">${shown
        .map((i) => `<li>${withSolution ? `<strong class="ok">${esc(i)}</strong>` : esc(i)}</li>`)
        .join("")}</ol>
        ${withSolution ? `<p class="note">Uvedeno ve správném pořadí.</p>` : `<p class="note">Doplň správné pořadí čísly.</p>`}`;
    }
    case "sorting": {
      const groups: any[] = Array.isArray(p.sorting?.groups) ? p.sorting.groups : [];
      const items: any[] = Array.isArray(p.sorting?.items) ? p.sorting.items : [];
      return `<p class="note">Skupiny: ${groups.map((g) => esc(g)).join(" · ")}</p>
        <ol class="opts">${items
          .map(
            (it) =>
              `<li>${esc(it?.text)} → ${
                withSolution ? `<strong class="ok">${esc(groups[it?.group ?? 0])}</strong>` : "…………………………"
              }</li>`,
          )
          .join("")}</ol>`;
    }
    case "fill_blanks":
      return `<p class="q">${tokensToText(p.fillBlanks?.tokens ?? [], withSolution) || esc(p.fillBlanks?.text)}</p>`;
    case "fill_choice":
      return `<p class="q">${tokensToText(p.fillChoice?.tokens ?? [], withSolution)}</p>
        <p class="note">Nabídka: ${(Array.isArray(p.fillChoice?.options) ? p.fillChoice.options : [])
          .map((o: any) => esc(o))
          .join(" · ")}</p>`;
    case "crossword": {
      const entries: any[] = Array.isArray(p.crossword?.entries) ? p.crossword.entries : [];
      return `<ol class="opts">${entries
        .map(
          (e) =>
            `<li>${esc(e?.clue)} — ${
              withSolution ? `<strong class="ok">${esc(e?.answer)}</strong>` : "…………………………"
            }</li>`,
        )
        .join("")}</ol>`;
    }
    case "flashcards": {
      const cards: any[] = Array.isArray(p.flashcards) ? p.flashcards : [];
      return `<table class="tbl"><thead><tr><th>Pojem</th><th>Vysvětlení</th></tr></thead><tbody>${cards
        .map(
          (c) =>
            `<tr><td>${esc(c?.front)}</td><td>${
              withSolution ? `<strong class="ok">${esc(c?.back)}</strong>` : ""
            }</td></tr>`,
        )
        .join("")}</tbody></table>`;
    }
    case "memory_game": {
      const pairs: any[] = Array.isArray(p.memoryGame?.pairs) ? p.memoryGame.pairs : [];
      return `<table class="tbl"><thead><tr><th>A</th><th>B</th></tr></thead><tbody>${pairs
        .map(
          (c) =>
            `<tr><td>${esc(c?.left)}</td><td>${
              withSolution ? `<strong class="ok">${esc(c?.right)}</strong>` : ""
            }</td></tr>`,
        )
        .join("")}</tbody></table>`;
    }
    case "reveal_cards": {
      const cards: any[] = Array.isArray(p.revealCards?.cards) ? p.revealCards.cards : [];
      return `<ol class="opts">${cards
        .map((c) => `<li><strong>${esc(c?.title)}</strong> — ${esc(c?.content)}${withSolution ? "" : answerLines(1)}</li>`)
        .join("")}</ol>`;
    }
    case "image_label": {
      const markers: any[] = Array.isArray(p.imageLabel?.markers) ? p.imageLabel.markers : [];
      const img = p.imageLabel?.imageUrl ? `<img class="img" src="${esc(p.imageLabel.imageUrl)}" alt="" />` : "";
      return `${img}<ol class="opts">${markers
        .map((m, i) => `<li>${i + 1}. ${withSolution ? `<strong class="ok">${esc(m?.label)}</strong>` : "…………………………"}</li>`)
        .join("")}</ol>`;
    }
    case "image_hotspot": {
      const hs: any[] = Array.isArray(p.imageHotspot?.hotspots) ? p.imageHotspot.hotspots : [];
      const img = p.imageHotspot?.imageUrl ? `<img class="img" src="${esc(p.imageHotspot.imageUrl)}" alt="" />` : "";
      return `${img}<ol class="opts">${hs
        .map((h) => `<li>${withSolution ? `<strong class="ok">${esc(h?.label)}</strong>` : esc(h?.label)}</li>`)
        .join("")}</ol>`;
    }
    case "wall":
      return `<p class="q">${esc(p.question)}</p>${withSolution ? "" : answerLines(4)}`;
    case "poll": {
      const opts: any[] = Array.isArray(p.options) ? p.options : [];
      return `<p class="q">${esc(p.question)}</p><ol class="opts">${opts
        .map((o) => `<li>${esc(o?.text)}</li>`)
        .join("")}</ol>`;
    }
    default:
      return `<p class="note">Tuto aktivitu je možné plnit jen online.</p>`;
  }
}

export interface ActivityPdfOptions {
  lessonTitle: string;
  variant: ActivityExportVariant;
}

/** Sestaví kompletní tiskový HTML dokument z vybraných bloků aktivit. */
export function buildActivitiesPrintHtml(blocks: Block[], options: ActivityPdfOptions): string {
  const withSolution = options.variant === "teacher";
  const sections = blocks
    .map((b, idx) => {
      const p = (b.props ?? {}) as Record<string, any>;
      const meta = activityMeta(p.activityType || "flashcards");
      const minutes = activityMinutes(p);
      const methods: string[] = Array.isArray(p.aiMethodNames) ? p.aiMethodNames : [];
      return `
      <section class="act" style="border-left-color:${meta.printColor}">
        <h2>${idx + 1}. ${esc(p.title || "Aktivita")}</h2>
        <p class="meta">${meta.icon} ${esc(meta.label)} · ${esc(activitySummary(p))}
          · ${p.required === true ? "Povinné" : "Nepovinné"}
          ${minutes ? `· ~${minutes} min` : ""}
          · ${esc(WORK_MODE_LABELS[p.workMode || "individual"] ?? "")}
          ${methods.length ? `· Metody: ${methods.map((m) => esc(m)).join(", ")}` : ""}</p>
        ${p.instructions ? `<p class="instr">${esc(p.instructions)}</p>` : ""}
        ${renderActivityBody(p, withSolution)}
        ${withSolution ? "" : `<div class="answer"><span>Odpověď:</span>${answerLines(2)}</div>`}
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="cs"><head><meta charset="utf-8" />
<title>${esc(options.lessonTitle)} – aktivity</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  body { font-family: "DejaVu Sans", Arial, sans-serif; color: #171717; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 19px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 11px; margin: 0 0 14px; }
  .act { border: 1px solid #e2e2e2; border-left-width: 5px; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; page-break-inside: avoid; }
  .act h2 { font-size: 14px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 10.5px; margin: 0 0 6px; }
  .instr { background: #f5f5f5; border-radius: 4px; padding: 6px 8px; margin: 0 0 8px; }
  .q { font-weight: 600; margin: 0 0 6px; }
  .opts { margin: 0 0 6px 18px; padding: 0; }
  .opts li { margin-bottom: 4px; }
  .tbl { width: 100%; border-collapse: collapse; margin-bottom: 6px; }
  .tbl th, .tbl td { border: 1px solid #ddd; padding: 4px 6px; text-align: left; font-size: 11.5px; }
  .note { color: #555; font-size: 11px; margin: 4px 0; }
  .ok { color: #0f7a3d; }
  .blank { display: inline-block; min-width: 90px; border-bottom: 1px solid #333; }
  .line { border-bottom: 1px solid #bbb; height: 18px; }
  .answer { margin-top: 6px; }
  .answer span { font-size: 10.5px; color: #666; }
  .img { max-width: 100%; max-height: 70mm; display: block; margin-bottom: 6px; }
</style></head>
<body>
  <h1>${esc(options.lessonTitle)}</h1>
  <p class="sub">${withSolution ? "S řešením pro učitele" : "Zadání pro žáky"} · ${blocks.length} aktivit · bezli.cz</p>
  ${sections || `<p class="note">Nebyla vybrána žádná aktivita.</p>`}
</body></html>`;
}

/** Otevře tiskové okno s vybranými aktivitami. */
export function printActivities(blocks: Block[], options: ActivityPdfOptions): void {
  const html = buildActivitiesPrintHtml(blocks, options);
  const win = window.open("", "_blank", "width=900,height=1000");
  if (!win) {
    throw new Error("Pop-up okno bylo zablokováno. Povolte pop-upy pro tuto stránku a zkuste to znovu.");
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  const trigger = () =>
    setTimeout(() => {
      try {
        win.focus();
        win.print();
      } catch (e) {
        console.error("[activities-pdf] print failed:", e);
      }
    }, 350);
  if (win.document.readyState === "complete") trigger();
  else win.onload = trigger;
}

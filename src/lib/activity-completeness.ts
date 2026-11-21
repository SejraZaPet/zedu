/** Co aktivitě chybí, aby šla zahrát (česky, pro učitele). Čistá funkce. */
const txt = (v: unknown) => String((v as any)?.text ?? v ?? "").replace(/<[^>]*>/g, "").trim();

export function activityMissing(spec: any): string[] {
  const at = String(spec?.activityType ?? "");
  const m: string[] = [];
  if (at === "mcq" || at === "poll") {
    if (!txt(spec?.question)) m.push("otázka");
    const opts: any[] = Array.isArray(spec?.options) ? spec.options : [];
    const filled = opts.filter((o) => txt(o));
    if (filled.length < 2) m.push("aspoň dvě vyplněné odpovědi");
    if (at === "mcq" && filled.length >= 2) {
      const ci = typeof spec?.correctIndex === "number" ? spec.correctIndex : opts.findIndex((o) => o?.correct || o?.isCorrect);
      if (ci < 0 || !txt(opts[ci])) m.push("označená správná odpověď");
    }
  } else if (at === "quiz") {
    const qs: any[] = spec?.quiz?.questions ?? [];
    if (!qs.some((q) => txt(q?.question))) m.push("aspoň jedna otázka");
  } else if (at === "wall" || at === "wordcloud") {
    if (!txt(spec?.question)) m.push("otázka pro žáky");
  } else if (at === "true_false") {
    if (!(spec?.trueFalse?.statements ?? []).some((s: any) => txt(s))) m.push("aspoň jedno tvrzení");
  } else if (at === "matching") {
    if (!(spec?.matching?.left ?? []).some((s: any) => txt(s))) m.push("aspoň jedna dvojice");
  } else if (at === "ordering") {
    if ((spec?.ordering?.items ?? []).filter((s: any) => txt(s)).length < 2) m.push("aspoň dvě položky k seřazení");
  }
  return m;
}

/** Souhrn pro celou prezentaci: „Slide 3 (Kvíz): chybí otázka, …“. */
export function presentationMissingReport(slides: any[]): string[] {
  const out: string[] = [];
  (slides ?? []).forEach((s, i) => {
    if (s?.type !== "activity" && s?.type !== "studio_step") return;
    const miss = activityMissing(s?.activitySpec);
    if (miss.length) out.push(`Slide ${i + 1}: chybí ${miss.join(", ")}`);
  });
  return out;
}

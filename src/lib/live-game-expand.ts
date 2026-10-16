/**
 * Převod snímků na „jedna otázka = jeden snímek“ při spuštění živé hry.
 * Pravda/Nepravda, spojování, doplňovačka a seřazení se rozloží na MCQ snímky,
 * které projektor, telefon i server už umí (otázka po otázce, rozložení odpovědí).
 * Deterministické – stejné vstupy dávají stejné pořadí odpovědí.
 * Ostatní snímky (prezentace, anketa, mrak…) projdou beze změny.
 */
const clean = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export function slideKind(s: any): string {
  return String(s?.activitySpec?.activityType || s?.activitySpec?.type || "").toLowerCase();
}

function mcqSlide(base: any, idx: number, question: string, answers: string[], correctIndex: number, instructions: string) {
  return {
    slideId: `${base?.slideId || "slide"}-q${idx + 1}`,
    type: "activity",
    ...(base?.ai_generated ? { ai_generated: true } : {}),
    ...(base?.backgroundOverride ? { backgroundOverride: base.backgroundOverride } : {}),
    ...(base?.timeLimit ? { timeLimit: base.timeLimit } : {}),
    ...(base?.gameMode ? { gameMode: base.gameMode } : {}),
    projector: { headline: question, body: "" },
    device: { instructions },
    teacherNotes: base?.teacherNotes || "",
    expandedFrom: slideKind(base),
    activitySpec: {
      activityType: "mcq",
      question,
      options: answers.map((text, i) => ({ text, correct: i === correctIndex, isCorrect: i === correctIndex })),
      correctIndex,
    },
  };
}

/** Rozmístí správnou odpověď deterministicky mezi až 3 distraktory. */
export function placeAnswer(correct: string, pool: string[], i: number): { answers: string[]; correctIndex: number } {
  const others = [...new Set(pool.filter((x) => x && x !== correct))];
  const k = others.length ? i % others.length : 0;
  const pick = others.slice(k).concat(others.slice(0, k)).slice(0, 3);
  const answers = [correct, ...pick];
  const pos = i % answers.length;
  [answers[0], answers[pos]] = [answers[pos], answers[0]];
  return { answers, correctIndex: pos };
}

export function expandSlide(s: any): any[] {
  const k = slideKind(s);
  const sp = s?.activitySpec || {};
  if (k === "true_false") {
    const st: any[] = sp?.trueFalse?.statements || [];
    const items = st
      .map((x) => ({ text: clean(x?.text ?? x?.statement ?? (typeof x === "string" ? x : "")), isTrue: x?.isTrue ?? x?.correct }))
      .filter((x) => x.text && typeof x.isTrue === "boolean");
    if (!items.length) return [s];
    return items.map((x, i) => mcqSlide(s, i, x.text, ["Pravda", "Nepravda"], x.isTrue ? 0 : 1, "Platí tvrzení?"));
  }
  if (k === "matching") {
    const l: any[] = sp?.matching?.left || [];
    const r: any[] = sp?.matching?.right || [];
    const pairs = l.map((x, i) => ({ left: clean(x), right: clean(r[i]) })).filter((p) => p.left && p.right);
    if (pairs.length < 2) return [s];
    const rights = pairs.map((p) => p.right);
    return pairs.map((p, i) => {
      const { answers, correctIndex } = placeAnswer(p.right, rights, i);
      return mcqSlide(s, i, `Co patří k pojmu „${p.left}“?`, answers, correctIndex, "Vyberte, co k pojmu patří.");
    });
  }
  if (k === "fill_blanks" || k === "fill_choice") {
    const blanks: { sentence: string; answer: string }[] = [];
    let extra: string[] = [];
    if (k === "fill_blanks") {
      const text = String(sp?.fillBlanks?.text || "");
      const sentences = text.split(/(?<=[.!?])\s+/);
      for (const sen of sentences) {
        const parts = [...sen.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => clean(m[1].split("|")[0]));
        parts.forEach((ans, j) => {
          let n = 0;
          const shown = clean(sen.replace(/\{\{([^}]+)\}\}/g, (_x, g) => (n++ === j ? "____" : clean(String(g).split("|")[0]))));
          if (ans) blanks.push({ sentence: shown, answer: ans });
        });
      }
    } else {
      const tokens: any[] = sp?.fillChoice?.tokens || [];
      extra = (sp?.fillChoice?.options || []).map(clean);
      tokens.forEach((t, ti) => {
        if (t?.type !== "blank") return;
        const sentence = clean(tokens.map((x, xi) => (xi === ti ? " ____ " : x?.type === "blank" ? x.answer : x?.value)).join(""));
        if (clean(t.answer)) blanks.push({ sentence, answer: clean(t.answer) });
      });
    }
    const pool = [...blanks.map((b) => b.answer), ...extra];
    const ok = blanks.filter((b) => new Set(pool.filter((x) => x !== b.answer)).size >= 1);
    if (!ok.length) return [s];
    return ok.map((b, i) => {
      const { answers, correctIndex } = placeAnswer(b.answer, pool, i);
      return mcqSlide(s, i, `Doplň: ${b.sentence}`, answers, correctIndex, "Vyberte slovo, které chybí.");
    });
  }
  if (k === "ordering") {
    const items: string[] = (sp?.ordering?.items || []).map((x: any) => clean(typeof x === "string" ? x : x?.text));
    const valid = items.filter(Boolean);
    if (valid.length < 2) return [s];
    const title = clean(sp?.question || s?.projector?.headline) || "Seřazení";
    return valid.map((item, i) => {
      const { answers, correctIndex } = placeAnswer(item, valid, i);
      return mcqSlide(s, i, `${title}: co je ${i + 1}. v pořadí?`, answers, correctIndex, "Vyberte správnou položku.");
    });
  }
  return [s];
}

/** Rozloží všechny snímky hry; idempotentní (MCQ snímky se nemění). */
export function expandSlidesForLiveGame(slides: any[] | null | undefined): any[] {
  return (slides || []).flatMap((s) => expandSlide(s));
}

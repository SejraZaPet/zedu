/**
 * „Rychlá hra“ – stavění snímků ze stručných dat a převody mezi typy (Wordwall styl).
 * Snímky mají stejný formát jako ostatní hry (activity_data v teacher_game_templates).
 */
export type QuickType = "mcq" | "true_false" | "matching";

export const QUICK_TYPES: { id: QuickType; label: string; emoji: string; hint: string }[] = [
  { id: "mcq", label: "Kvíz", emoji: "❓", hint: "Otázka a několik odpovědí, jedna správná." },
  { id: "true_false", label: "Pravda/Nepravda", emoji: "✅", hint: "Tvrzení, žáci rozhodnou, zda platí." },
  { id: "matching", label: "Přiřazování", emoji: "🔗", hint: "Dvojice pojem – vysvětlení." },
];

export interface McqItem { question: string; answers: string[]; correctIndex: number; explanation?: string }
export interface TfItem { text: string; isTrue: boolean }
export interface PairItem { left: string; right: string }

let seq = 0;
const sid = (p: string) => `${p}-${Date.now()}-${seq++}`;
const t = (v: unknown) => String(v ?? "").trim();

export function buildMcq(q: McqItem, ai = false) {
  const answers = q.answers.map(t).filter(Boolean);
  const ci = Math.min(Math.max(0, q.correctIndex), answers.length - 1);
  return {
    slideId: sid("quick"),
    type: "activity",
    ...(ai ? { ai_generated: true } : {}),
    projector: { headline: t(q.question), body: "" },
    device: { instructions: "Vyberte správnou odpověď." },
    activitySpec: {
      activityType: "mcq",
      question: t(q.question),
      options: answers.map((text, i) => ({ text, correct: i === ci, isCorrect: i === ci })),
      correctIndex: ci,
      ...(q.explanation ? { explanation: q.explanation } : {}),
    },
  };
}

export function buildTrueFalse(items: TfItem[], headline = "Pravda, nebo nepravda?", ai = false) {
  return {
    slideId: sid("quick"),
    type: "activity",
    ...(ai ? { ai_generated: true } : {}),
    projector: { headline, body: "" },
    device: { instructions: "Rozhodněte, zda tvrzení platí." },
    activitySpec: {
      activityType: "true_false",
      question: headline,
      trueFalse: { statements: items.map((s) => ({ text: t(s.text), isTrue: !!s.isTrue })).filter((s) => s.text) },
    },
  };
}

export function buildMatching(pairs: PairItem[], headline = "Přiřaďte k sobě", ai = false) {
  const ok = pairs.map((p) => ({ left: t(p.left), right: t(p.right) })).filter((p) => p.left && p.right);
  return {
    slideId: sid("quick"),
    type: "activity",
    ...(ai ? { ai_generated: true } : {}),
    projector: { headline, body: "" },
    device: { instructions: "Spojte, co k sobě patří." },
    activitySpec: {
      activityType: "matching",
      question: headline,
      matching: { left: ok.map((p) => p.left), right: ok.map((p) => p.right) },
    },
  };
}

// ---------- Čtení snímků ----------
export function slideType(s: any): string {
  return String(s?.activitySpec?.activityType || s?.activitySpec?.type || s?.type || "").toLowerCase();
}

function readMcq(s: any): McqItem | null {
  const sp = s?.activitySpec;
  if (!sp || slideType(s) !== "mcq") return null;
  const opts: any[] = Array.isArray(sp.options) ? sp.options : [];
  const answers = opts.map((o) => t(typeof o === "string" ? o : o?.text)).filter(Boolean);
  if (!t(sp.question) || answers.length < 2) return null;
  let ci = opts.findIndex((o) => o?.correct || o?.isCorrect);
  if (ci < 0) ci = Number.isInteger(sp.correctIndex) ? sp.correctIndex : 0;
  return { question: t(sp.question), answers, correctIndex: ci };
}

function readTf(s: any): TfItem[] {
  const st: any[] = s?.activitySpec?.trueFalse?.statements || [];
  return st.map((x) => ({ text: t(x?.text ?? x?.statement ?? x), isTrue: !!(x?.isTrue ?? x?.correct) })).filter((x) => x.text);
}

function readPairs(s: any): PairItem[] {
  const m = s?.activitySpec?.matching || {};
  const l: string[] = m.left || [];
  const r: string[] = m.right || [];
  return l.map((x, i) => ({ left: t(x), right: t(r[i]) })).filter((p) => p.left && p.right);
}

// ---------- Převody ----------
/** Vrátí nové snímky po převodu, nebo null, když převod nedává smysl. */
export function convertSlide(s: any, to: QuickType): any[] | null {
  const from = slideType(s);
  if (from === to) return null;
  const ai = !!s?.ai_generated;
  const bg = s?.backgroundOverride ? { backgroundOverride: s.backgroundOverride } : {};
  const withBg = (arr: any[]) => arr.map((x) => ({ ...x, ...bg }));

  if (from === "mcq") {
    const q = readMcq(s);
    if (!q) return null;
    if (to === "true_false") {
      // Každá odpověď se stane tvrzením „otázka – odpověď“.
      const items = q.answers.map((a, i) => ({ text: `${q.question.replace(/\?\s*$/, "")}: ${a}`, isTrue: i === q.correctIndex }));
      return withBg([buildTrueFalse(items, q.question, ai)]);
    }
    return null; // jedna otázka nemá dost dvojic – viz mergeMcqToMatching
  }
  if (from === "true_false") {
    const items = readTf(s);
    if (!items.length) return null;
    if (to === "mcq") {
      return withBg(items.map((it) => buildMcq({ question: it.text, answers: ["Pravda", "Nepravda"], correctIndex: it.isTrue ? 0 : 1 }, ai)));
    }
    return null;
  }
  if (from === "matching") {
    const pairs = readPairs(s);
    if (pairs.length < 2) return null;
    if (to === "mcq") {
      const rights = pairs.map((p) => p.right);
      return withBg(pairs.map((p, i) => {
        const others = rights.filter((_, j) => j !== i).sort(() => Math.random() - 0.5).slice(0, 3);
        const answers = [p.right, ...others].sort(() => Math.random() - 0.5);
        return buildMcq({ question: `Co patří k pojmu „${p.left}“?`, answers, correctIndex: answers.indexOf(p.right) }, ai);
      }));
    }
    if (to === "true_false") {
      const items = pairs.map((p, i) => {
        const lie = i % 2 === 1 && pairs.length > 1;
        const right = lie ? pairs[(i + 1) % pairs.length].right : p.right;
        return { text: `${p.left} – ${right}`, isTrue: !lie };
      });
      return withBg([buildTrueFalse(items, s?.projector?.headline || "Pravda, nebo nepravda?", ai)]);
    }
  }
  return null;
}

export function canConvert(s: any, to: QuickType) {
  return convertSlide(s, to) !== null;
}

/** Kvízové otázky s krátkou správnou odpovědí (pojem → vysvětlení) spojí do jednoho přiřazování. */
export function mergeMcqToMatching(slides: any[]): any[] | null {
  const idx: number[] = [];
  const pairs: PairItem[] = [];
  slides.forEach((s, i) => {
    const q = readMcq(s);
    if (!q) return;
    const ans = q.answers[q.correctIndex];
    if (!ans || ans.length > 60 || q.question.length > 120) return;
    idx.push(i);
    pairs.push({ left: q.question, right: ans });
  });
  if (pairs.length < 2) return null;
  const merged = buildMatching(pairs.slice(0, 8), "Přiřaďte odpovědi k otázkám", slides.some((s) => s?.ai_generated));
  const out: any[] = [];
  const used = new Set(idx.slice(0, 8));
  slides.forEach((s, i) => {
    if (i === idx[0]) out.push(merged);
    if (!used.has(i)) out.push(s);
  });
  return out;
}

// ---------- Typ hry pro knihovnu ----------
export type LibraryType = "mcq" | "true_false" | "matching" | "mixed" | "presentation";
export const LIBRARY_TYPE_LABEL: Record<LibraryType, string> = {
  mcq: "Kvíz",
  true_false: "Pravda/Nepravda",
  matching: "Přiřazování",
  mixed: "Kombinovaná",
  presentation: "Prezentace",
};

const QUESTION_TYPES = new Set(["mcq", "quiz", "true_false", "matching", "sorting", "ordering", "fill_choice", "fill_blanks"]);

export function gameLibraryType(slides: any[]): LibraryType {
  const types = (slides || []).map(slideType).filter((x) => QUESTION_TYPES.has(x)).map((x) => (x === "quiz" ? "mcq" : x));
  if (!types.length) return "presentation";
  const uniq = new Set(types);
  if (uniq.size === 1) {
    const only = [...uniq][0];
    if (only === "mcq" || only === "true_false" || only === "matching") return only;
  }
  return "mixed";
}

export function countQuestions(slides: any[]): number {
  return (slides || []).reduce((n, s) => {
    const ty = slideType(s);
    if (ty === "true_false") return n + (s?.activitySpec?.trueFalse?.statements?.length || 0);
    if (ty === "matching") return n + (s?.activitySpec?.matching?.left?.length || 0);
    return n + (QUESTION_TYPES.has(ty) ? 1 : 0);
  }, 0);
}

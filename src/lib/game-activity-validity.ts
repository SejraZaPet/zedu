/**
 * Kontrola, zda aktivita převzatá z lekce má skutečný obsah (otázku a odpovědi).
 * Prázdné aktivity se do her nevkládají – žáci by na ně nemohli odpovědět.
 */
const txt = (v: any) => String(v?.text ?? v ?? "").replace(/<[^>]*>/g, "").trim();
const filled = (arr: any, min = 1, pick: (x: any) => any = (x) => x) =>
  (Array.isArray(arr) ? arr : []).filter((x) => txt(pick(x)).length > 0).length >= min;

function quizHasQuestion(q: any): boolean {
  if (!q) return false;
  if (Array.isArray(q.questions)) return q.questions.some((x: any) => quizHasQuestion(x));
  return txt(q.question).length > 0 && filled(q.answers, 2);
}

export function isActivityFilled(spec: any): boolean {
  if (!spec || typeof spec !== "object") return false;
  const type = String(spec.activityType || spec.type || "").toLowerCase();
  switch (type) {
    case "mcq":
      return txt(spec.question).length > 0 && filled(spec.options, 2);
    case "quiz":
    case "":
      return quizHasQuestion(spec.quiz) || quizHasQuestion(spec) ||
        (txt(spec.question).length > 0 && filled(spec.options, 2));
    case "true_false":
      return filled(spec.trueFalse?.statements, 1, (s) => s?.text ?? s?.statement ?? s);
    case "sorting":
      return filled(spec.sorting?.items, 2);
    case "matching":
      return filled(spec.matching?.left, 2);
    case "ordering":
      return filled(spec.ordering?.items, 2);
    case "flashcards":
      return filled(spec.flashcards, 1, (c) => c?.front ?? c?.term ?? c);
    case "memory_game":
      return filled(spec.memoryGame?.pairs, 2, (p) => p?.left ?? p?.a ?? p?.front ?? p);
    case "fill_blanks":
      return filled(spec.fillBlanks?.tokens, 1) || filled(spec.blankAnswers, 1);
    case "fill_choice":
      return filled(spec.fillChoice?.options, 2);
    case "crossword":
      return filled(spec.crossword?.entries, 1, (e) => e?.answer ?? e?.word ?? e);
    case "wall":
    case "poll":
    case "wordcloud":
      return txt(spec.question || spec.prompt).length > 0;
    default:
      return true;
  }
}

/** Vyřadí ze snímků hry aktivity bez obsahu. Vrací i počet vyřazených. */
export function dropEmptyActivitySlides<T extends { type?: string; activitySpec?: any }>(
  slides: T[],
): { slides: T[]; dropped: number } {
  const kept = slides.filter((s) => s.type !== "activity" || isActivityFilled(s.activitySpec));
  return { slides: kept, dropped: slides.length - kept.length };
}

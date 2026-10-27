/** Čisté pomocné funkce procvičování „Učím se“ (testovatelné, bez UI). */
export type PracticeQuestion = {
  type: "open" | "short_answer" | "multiple_choice" | "true_false";
  options?: string[];
  correct_index?: number;
  correct_answer?: string | boolean;
};
export type PracticeAnswer = string | number | boolean | undefined;

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

export function evaluatePracticeAnswer(q: PracticeQuestion, answer: PracticeAnswer): boolean | null {
  if (q.type === "open") return null;
  if (q.type === "multiple_choice") {
    if (typeof answer !== "number" || typeof q.correct_index !== "number") return false;
    return answer === q.correct_index;
  }
  if (q.type === "true_false") {
    if (typeof answer !== "boolean") return false;
    return answer === Boolean(q.correct_answer);
  }
  if (q.type === "short_answer") {
    if (typeof answer !== "string" || typeof q.correct_answer !== "string") return false;
    const a = norm(answer);
    const c = norm(q.correct_answer);
    return a.length > 0 && (a === c || a.includes(c) || c.includes(a));
  }
  return false;
}

/** Skóre z odpovědí (klíče = pořadí otázky přes všechny fáze). Počítá se přímo, ne ze stavu. */
export function scorePractice(questions: PracticeQuestion[], answers: Record<string, PracticeAnswer>) {
  let correct = 0;
  let total = 0;
  questions.forEach((q, i) => {
    if (q.type === "open") return;
    total++;
    if (evaluatePracticeAnswer(q, answers[String(i)])) correct++;
  });
  return { correct, total, percent: total > 0 ? Math.round((correct / total) * 100) : 0 };
}

/** Text správné odpovědi pro zobrazení (pravda/nepravda česky); null = nezobrazovat. */
export function correctAnswerLabel(q: PracticeQuestion): string | null {
  if (q.type === "true_false") {
    if (q.correct_answer === undefined || q.correct_answer === null) return null;
    return Boolean(q.correct_answer) ? "Pravda" : "Nepravda";
  }
  if (typeof q.correct_answer === "string" && q.correct_answer.trim()) return q.correct_answer;
  return null;
}

const DIFF: Record<string, string> = { easy: "základní", medium: "střední", hard: "náročnější" };
export const difficultyLabelCs = (d: string | null | undefined) => DIFF[d ?? "medium"] ?? DIFF.medium;

export const hasOpenQuestions = (qs: PracticeQuestion[]) => qs.some((q) => q.type === "open");

/**
 * Kvíz může obsahovat víc otázek. Historicky se ukládala jen jedna otázka
 * (`props.quiz = { question, answers, explanation }`), případně AI vracela
 * pole otázek. Tyto helpery sjednocují všechny varianty na pole otázek.
 */

export interface QuizAnswer {
  text: string;
  correct: boolean;
}

export interface QuizQuestion {
  question: string;
  answers: QuizAnswer[];
  explanation?: string;
}

const normalizeOne = (raw: any): QuizQuestion | null => {
  if (!raw || typeof raw !== "object") return null;
  const answers: QuizAnswer[] = Array.isArray(raw.answers)
    ? raw.answers
        .filter((a: any) => a && typeof a === "object")
        .map((a: any) => ({ text: String(a.text ?? ""), correct: a.correct === true }))
    : [];
  const question = String(raw.question ?? "");
  if (!question && answers.length === 0) return null;
  return { question, answers, explanation: raw.explanation ? String(raw.explanation) : undefined };
};

/** Vrátí otázky kvízu z libovolného uloženého tvaru. */
export const getQuizQuestions = (quizProp: any): QuizQuestion[] => {
  if (!quizProp) return [];
  if (Array.isArray(quizProp)) return quizProp.map(normalizeOne).filter(Boolean) as QuizQuestion[];
  if (Array.isArray(quizProp.questions)) {
    return quizProp.questions.map(normalizeOne).filter(Boolean) as QuizQuestion[];
  }
  const one = normalizeOne(quizProp);
  return one ? [one] : [];
};

/** Prázdná otázka pro editor. */
export const emptyQuizQuestion = (): QuizQuestion => ({
  question: "",
  answers: [
    { text: "", correct: true },
    { text: "", correct: false },
  ],
});

/** Uloží otázky do kanonického tvaru `{ questions: [...] }`. */
export const setQuizQuestions = (questions: QuizQuestion[]) => ({ questions });

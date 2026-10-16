/** Snapshot of a graded lesson item; never used for live-game grading. */
export interface ActivityAnswer {
  index: number;
  studentAnswer: string;
  correctAnswer: string;
  correct: boolean;
  text: string;
  explanation?: string;
}

export type ActivityCompletion = (score: number, maxScore: number, answers?: ActivityAnswer[]) => void;

/** Legacy/null or malformed payloads must not fabricate a review. */
export function readActivityAnswers(value: unknown): ActivityAnswer[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  if (!value.every((item) => item && typeof item === "object" &&
    Number.isInteger(item.index) && item.index >= 0 && typeof item.text === "string" &&
    typeof item.studentAnswer === "string" && typeof item.correctAnswer === "string" &&
    typeof item.correct === "boolean" && (item.explanation === undefined || typeof item.explanation === "string"))) return undefined;
  if (new Set(value.map((item) => item.index)).size !== value.length) return undefined;
  return value as ActivityAnswer[];
}
import type { ActivityAnswer } from "@/lib/activity-answers";

const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));

/** Seřazení: `placedIndexes[i]` = původní (správný) index položky na pozici i. */
export function evaluateOrdering(correctOrder: unknown, placedIndexes: unknown) {
  const order = Array.isArray(correctOrder) ? correctOrder.map(s) : [];
  const placed = Array.isArray(placedIndexes) ? placedIndexes : [];
  const answers: ActivityAnswer[] = order.map((text, i) => {
    const at = placed[i];
    const studentText = Number.isInteger(at) && at >= 0 && at < order.length ? order[at] : "";
    return {
      index: i,
      text: `${i + 1}. místo`,
      studentAnswer: studentText || "Bez odpovědi",
      correctAnswer: text,
      correct: at === i,
    };
  });
  return { score: answers.filter((a) => a.correct).length, maxScore: order.length, answers };
}

/** Obrázek s popisem: porovná umístěné popisky se správnými u každé značky. */
export function evaluateImageLabel(markers: unknown, placed: unknown) {
  const list = Array.isArray(markers) ? markers : [];
  const map = placed && typeof placed === "object" ? (placed as Record<string, unknown>) : {};
  const answers: ActivityAnswer[] = list.map((m: any, i) => {
    const correctAnswer = s(m?.label);
    const studentAnswer = s(map[i]);
    return {
      index: i,
      text: `Značka ${i + 1}`,
      studentAnswer: studentAnswer || "Bez odpovědi",
      correctAnswer,
      correct: !!studentAnswer && studentAnswer === correctAnswer,
    };
  });
  return { score: answers.filter((a) => a.correct).length, maxScore: list.length, answers };
}

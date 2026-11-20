import type { GameResponse } from "@/lib/game-types";

type AnySlide = Record<string, any>;

export interface GameQuestionResult {
  index: number;
  question: string;
  correct: number;
  total: number;
  successPct: number;
}

export interface PersonalGameSummary {
  correct: { index: number; question: string }[];
  practice: { index: number; question: string }[];
}

const cleanText = (value: unknown): string =>
  String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function gameQuestionLabel(slide: AnySlide, index: number): string {
  const spec = slide?.activitySpec ?? {};
  const candidates = [
    slide?.question,
    spec?.question,
    spec?.prompt,
    spec?.title,
    slide?.projector?.headline,
    slide?.title,
  ];
  const label = candidates.map(cleanText).find(Boolean);
  return label || `Otázka ${index + 1}`;
}

export function computeGameQuestionResults(
  slides: AnySlide[],
  responses: Pick<GameResponse, "question_index" | "is_correct">[],
): GameQuestionResult[] {
  const byIndex = new Map<number, Pick<GameResponse, "question_index" | "is_correct">[]>();
  responses.forEach((response) => {
    const current = byIndex.get(response.question_index) ?? [];
    current.push(response);
    byIndex.set(response.question_index, current);
  });

  return slides
    .map((slide, index) => {
      const relevant = byIndex.get(index) ?? [];
      if (relevant.length === 0) return null;
      const correct = relevant.filter((response) => response.is_correct).length;
      return {
        index,
        question: gameQuestionLabel(slide, index),
        correct,
        total: relevant.length,
        successPct: Math.round((correct / relevant.length) * 100),
      };
    })
    .filter((row): row is GameQuestionResult => row !== null)
    .sort((a, b) => a.successPct - b.successPct || a.index - b.index);
}

export function computePersonalGameSummary(
  slides: AnySlide[],
  responses: Pick<GameResponse, "player_id" | "question_index" | "is_correct">[],
  playerId: string,
): PersonalGameSummary {
  const answered = responses
    .filter((response) => response.player_id === playerId)
    .sort((a, b) => a.question_index - b.question_index);

  const summary: PersonalGameSummary = { correct: [], practice: [] };
  answered.forEach((response) => {
    const item = {
      index: response.question_index,
      question: gameQuestionLabel(slides[response.question_index] ?? {}, response.question_index),
    };
    if (response.is_correct) summary.correct.push(item);
    else summary.practice.push(item);
  });
  return summary;
}
type AccuracyResponse = Pick<GameResponse, "is_correct"> & { answer?: unknown };

/** Credit of one response: solo rounds count the share of correct items, others 0/1. */
export function responseCredit(response: AccuracyResponse): number {
  const a = response.answer as { soloRound?: boolean; correctCount?: number; totalCount?: number } | null | undefined;
  if (a?.soloRound && typeof a.totalCount === "number" && a.totalCount > 0) {
    const share = Number(a.correctCount ?? 0) / a.totalCount;
    return Math.max(0, Math.min(1, Number.isFinite(share) ? share : 0));
  }
  return response.is_correct ? 1 : 0;
}

/** Accuracy in % over answered steps; null when nothing was answered (never a fake 0 %). */
export function accuracyPct(responses: AccuracyResponse[]): number | null {
  if (responses.length === 0) return null;
  const credit = responses.reduce((sum, r) => sum + responseCredit(r), 0);
  return Math.round((credit / responses.length) * 100);
}

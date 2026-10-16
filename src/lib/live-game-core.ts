/**
 * Jedno jádro živých her pro obě cesty (/hra i /live).
 * Kontrakt: aktivita → MCQ snímky (live-game-expand) → otázky pro starší
 * cestu /hra. Bodování rozhoduje vždy server (_shared/game-scoring.ts).
 */
import { expandSlide } from "@/lib/live-game-expand";
import type { GameQuestion } from "@/lib/game-types";

/** Typy aktivit, které jdou hrát živě (rozloží se na samostatné otázky). */
export const LIVE_GAME_ACTIVITY_TYPES = ["quiz", "true_false", "matching", "fill_blanks", "fill_choice", "ordering"] as const;

export const isLiveGameActivity = (at: unknown) =>
  (LIVE_GAME_ACTIVITY_TYPES as readonly string[]).includes(String(at ?? ""));

const clean = (v: unknown) => String(v ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();

export interface CoreQuestion { question: string; answers: string[]; correctIndex: number; explanation?: string }

/** Aktivita z lekce/průvodce → jednotné otázky (každá jedna správná odpověď). */
export function activityToCoreQuestions(props: any): CoreQuestion[] {
  const at = String(props?.activityType ?? "");
  if (at === "quiz") {
    return (props?.quiz?.questions ?? []).map((q: any) => {
      const raw = (Array.isArray(q?.answers) ? q.answers : []).filter((a: any) => clean(a?.text ?? a));
      const answers = raw.map((a: any) => clean(a?.text ?? a));
      const ci = raw.findIndex((a: any) => a?.correct);
      return { question: clean(q?.question), answers, correctIndex: Math.max(0, ci), ...(q?.explanation ? { explanation: q.explanation } : {}) };
    }).filter((q: CoreQuestion) => q.question && q.answers.length >= 2);
  }
  if (!isLiveGameActivity(at)) return [];
  const slide = { slideId: "a", type: "activity", activitySpec: { ...props, activityType: at, question: props?.title || props?.question } };
  return expandSlide(slide)
    .filter((s) => s?.activitySpec?.activityType === "mcq")
    .map((s) => ({
      question: s.activitySpec.question,
      answers: s.activitySpec.options.map((o: any) => o.text),
      correctIndex: s.activitySpec.correctIndex,
    }));
}

/** Jednotné otázky → formát starší cesty /hra (game_sessions.activity_data). */
export function coreToGameQuestions(qs: CoreQuestion[]): GameQuestion[] {
  return qs.map((q) => {
    const tf = q.answers.length === 2 && q.answers[0] === "Pravda" && q.answers[1] === "Nepravda";
    return {
      question: q.question,
      answers: q.answers.map((text, i) => ({ text, correct: i === q.correctIndex })),
      type: tf ? "true_false" : "quiz",
      ...(q.explanation ? { explanation: q.explanation } : {}),
    };
  });
}

/**
 * Samostatné kolo živé hry: jedna aktivita = jedna serverově ohodnocená odpověď.
 * Čistý modul sdílený telefonem/projektorem a edge funkcí. Klient nikdy nerozhoduje
 * o správnosti ani bodech; jeho `score`, `isCorrect` a `correctCount` se ignorují.
 */

export const SOLO_ROUND_TYPES = [
  "matching", "ordering", "fill_blanks", "fill_choice", "sorting", "flashcards",
  "memory_game", "crossword", "image_label", "image_hotspot", "reveal_cards",
] as const;

export type SoloRoundType = typeof SOLO_ROUND_TYPES[number];
export interface SoloRoundItemResult { index: number; correct: boolean }
export interface SoloRoundEvaluation {
  correctCount: number;
  totalCount: number;
  itemResults: SoloRoundItemResult[];
}

export const supportsSoloRoundType = (type: unknown): type is SoloRoundType =>
  (SOLO_ROUND_TYPES as readonly string[]).includes(String(type ?? ""));

export const isSoloRoundSlide = (slide: any): boolean =>
  slide?.type === "activity" && slide?.activitySpec?.soloRound === true
  && supportsSoloRoundType(slide?.activitySpec?.activityType);

const text = (v: unknown) => String(v ?? "").trim();
const list = (v: unknown): any[] => Array.isArray(v) ? v : [];
const map = (v: unknown): Record<string, any> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, any> : {};
const normalized = (v: unknown, caseSensitive = false, diacriticSensitive = true) => {
  let s = text(v);
  if (!caseSensitive) s = s.toLowerCase();
  if (!diacriticSensitive) s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return s;
};
const evaluation = (items: boolean[]): SoloRoundEvaluation => ({
  correctCount: items.filter(Boolean).length,
  totalCount: items.length,
  itemResults: items.map((correct, index) => ({ index, correct })),
});
const selectedIndex = (value: unknown) => Number.isInteger(value) && Number(value) >= 0 ? Number(value) : -1;
const hasIndex = (values: unknown, index: number) => list(values).some((value) => selectedIndex(value) === index);
const indexed = (payload: any, key: string) => map(payload?.[key]);

function fillBlankAnswers(spec: any): { answer: string; alternatives: string[] }[] {
  const data = spec?.fillBlanks ?? {};
  const tokens = list(data.tokens).filter((t) => t?.type === "blank");
  if (tokens.length) return tokens.map((t) => ({ answer: text(t.answer), alternatives: list(t.alternatives).map(text) }));
  const out: { answer: string; alternatives: string[] }[] = [];
  for (const match of String(data.text ?? "").matchAll(/\{\{([^}]+)\}\}/g)) {
    const parts = String(match[1]).split(/[\/|]/).map(text);
    out.push({ answer: parts[0] ?? "", alternatives: parts.slice(1) });
  }
  return out;
}

/** Přepočet výhradně ze zadání a voleb žáka; žádné skóre z klienta se nečte. */
export function evaluateSoloRound(spec: any, payload: any): SoloRoundEvaluation {
  const type = String(spec?.activityType ?? "");
  switch (type) {
    case "matching": {
      const left = list(spec?.matching?.left);
      const selections = indexed(payload, "selections");
      return evaluation(left.map((_, i) => selectedIndex(selections[i]) === i));
    }
    case "ordering": {
      const items = list(spec?.ordering?.items);
      const order = list(payload?.order);
      return evaluation(items.map((_, i) => selectedIndex(order[i]) === i));
    }
    case "fill_blanks": {
      const blanks = fillBlankAnswers(spec);
      const answers = list(payload?.answers);
      const caseSensitive = spec?.fillBlanks?.caseSensitive === true;
      const diacriticSensitive = spec?.fillBlanks?.diacriticSensitive !== false;
      return evaluation(blanks.map((blank, i) => {
        const answer = normalized(answers[i], caseSensitive, diacriticSensitive);
        return [blank.answer, ...blank.alternatives].some((accepted) => normalized(accepted, caseSensitive, diacriticSensitive) === answer);
      }));
    }
    case "fill_choice": {
      const blanks = list(spec?.fillChoice?.tokens).filter((t) => t?.type === "blank");
      const answers = list(payload?.answers);
      return evaluation(blanks.map((blank, i) => normalized(answers[i]) === normalized(blank.answer)));
    }
    case "sorting": {
      const items = list(spec?.sorting?.items);
      const assignments = indexed(payload, "assignments");
      return evaluation(items.map((item, i) => selectedIndex(assignments[i]) === Number(item?.group)));
    }
    case "image_label": {
      const markers = list(spec?.imageLabel?.markers);
      const placed = indexed(payload, "placed");
      return evaluation(markers.map((marker, i) => text(placed[i]) !== "" && text(placed[i]) === text(marker?.label)));
    }
    case "image_hotspot": {
      const hotspots = list(spec?.imageHotspot?.hotspots);
      const positions = indexed(payload, "positions");
      const selections = indexed(payload, "selections");
      return evaluation(hotspots.map((hotspot, i) => {
        if (selectedIndex(selections[i]) >= 0) return selectedIndex(selections[i]) === i;
        const point = positions[i];
        if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return false;
        const dx = Number(point.x) - Number(hotspot?.x);
        const dy = Number(point.y) - Number(hotspot?.y);
        return Math.sqrt(dx * dx + dy * dy) <= (Number(hotspot?.radius) || 8);
      }));
    }
    case "flashcards": {
      const cards = list(spec?.flashcards);
      const seen = list(payload?.seen);
      return evaluation(cards.map((_, i) => hasIndex(seen, i)));
    }
    case "reveal_cards": {
      const cards = list(spec?.revealCards?.cards);
      const opened = list(payload?.opened);
      return evaluation(cards.map((_, i) => hasIndex(opened, i)));
    }
    case "memory_game": {
      const pairs = list(spec?.memoryGame?.pairs);
      const matched = list(payload?.matchedPairs);
      return evaluation(pairs.map((_, i) => hasIndex(matched, i)));
    }
    case "crossword": {
      const entries = list(spec?.crossword?.entries);
      const words = list(payload?.words);
      return evaluation(entries.map((entry, i) => {
        const submitted = words.find((word) => word && typeof word === "object" && Number(word.index) === i) ?? words[i];
        const value = submitted && typeof submitted === "object" ? submitted.value : submitted;
        return normalized(value).replace(/\s/g, "") === normalized(entry?.answer).replace(/\s/g, "") && normalized(entry?.answer) !== "";
      }));
    }
    default:
      return evaluation([]);
  }
}

// Bodová pravidla jsou jedině v _shared/game-scoring.ts; re-export pro společný import typů.
export { soloRoundPoints } from "./game-scoring.ts";

export interface SoloRoundResponseLike {
  player_id: string;
  answer?: any;
  score?: number | null;
}

export interface SoloRoundItemMistake { index: number; count: number }

/** Průměr třídy zahrnuje i neodeslané hráče jako 0; chyby položek jen skutečná odevzdání. */
export function summarizeSoloRound(responses: SoloRoundResponseLike[], playerCount: number) {
  const evaluations = responses.map((r) => ({
    correctCount: Math.max(0, Number(r.answer?.correctCount) || 0),
    totalCount: Math.max(0, Number(r.answer?.totalCount) || 0),
  }));
  const ratioSum = evaluations.reduce((sum, r) => sum + (r.totalCount > 0 ? r.correctCount / r.totalCount : 0), 0);
  const mistakes = new Map<number, number>();
  for (const response of responses) {
    for (const item of list(response.answer?.itemResults)) {
      if (item?.correct !== false || !Number.isInteger(item.index)) continue;
      mistakes.set(item.index, (mistakes.get(item.index) ?? 0) + 1);
    }
  }
  return {
    answeredCount: responses.length,
    playerCount,
    averageSuccessRate: playerCount > 0 ? Math.round((ratioSum / playerCount) * 100) : null,
    mostMissed: [...mistakes.entries()]
      .map(([index, count]): SoloRoundItemMistake => ({ index, count }))
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 5),
  };
}

/** Body kola i celkové body týmu = průměr na připojeného člena, neodeslaný člen má 0. */
export function soloRoundTeamScores(teams: any[], players: any[], responses: SoloRoundResponseLike[]) {
  const byPlayer = new Map(players.map((p) => [String(p.id), p]));
  const byResponse = new Map(responses.map((r) => [String(r.player_id), r]));
  return (teams ?? []).map((team) => {
    const members = list(team?.members).map(String).filter((id) => byPlayer.has(id));
    const roundTotal = members.reduce((sum, id) => sum + (Number(byResponse.get(id)?.score) || 0), 0);
    const total = members.reduce((sum, id) => sum + (Number(byPlayer.get(id)?.total_score) || 0), 0);
    return {
      teamId: String(team?.id ?? ""),
      roundScore: members.length ? Math.round(roundTotal / members.length) : 0,
      totalScore: members.length ? Math.round(total / members.length) : 0,
      memberCount: members.length,
    };
  }).sort((a, b) => b.totalScore - a.totalScore || a.teamId.localeCompare(b.teamId));
}

/** Počet hodnocených položek pro odhad času a souhrn sady. */
export function soloRoundItemCount(spec: any): number {
  switch (String(spec?.activityType ?? "")) {
    case "matching": return list(spec?.matching?.left).length;
    case "ordering": return list(spec?.ordering?.items).length;
    case "fill_blanks": return fillBlankAnswers(spec).length;
    case "fill_choice": return list(spec?.fillChoice?.tokens).filter((t) => t?.type === "blank").length;
    case "sorting": return list(spec?.sorting?.items).length;
    case "flashcards": return list(spec?.flashcards).length;
    case "memory_game": return list(spec?.memoryGame?.pairs).length;
    case "crossword": return list(spec?.crossword?.entries).length;
    case "image_label": return list(spec?.imageLabel?.markers).length;
    case "image_hotspot": return list(spec?.imageHotspot?.hotspots).length;
    case "reveal_cards": return list(spec?.revealCards?.cards).length;
    default: return 0;
  }
}

/** 15 s/položku (kartičky 8 s, hotspot 12 s), zaokrouhleno na 5 s, 45–300 s. */
export function suggestedSoloRoundTimeSec(spec: any): number {
  const type = String(spec?.activityType ?? "");
  const perItem = type === "flashcards" || type === "reveal_cards" ? 8 : type === "image_hotspot" ? 12 : 15;
  const count = Math.max(1, soloRoundItemCount(spec));
  return Math.min(300, Math.max(45, Math.ceil((count * perItem) / 5) * 5));
}

/** Popis položky pro projektor po skončení (před koncem se nepoužívá). */
export function soloRoundItemLabel(spec: any, index: number): string {
  switch (String(spec?.activityType ?? "")) {
    case "matching": return text(spec?.matching?.left?.[index]) || `Dvojice ${index + 1}`;
    case "ordering": return `${index + 1}. místo`;
    case "fill_blanks": case "fill_choice": return `Mezera ${index + 1}`;
    case "sorting": return text(spec?.sorting?.items?.[index]?.text) || `Položka ${index + 1}`;
    case "image_label": return text(spec?.imageLabel?.markers?.[index]?.label) || `Značka ${index + 1}`;
    case "image_hotspot": return text(spec?.imageHotspot?.hotspots?.[index]?.label) || `Místo ${index + 1}`;
    case "flashcards": return text(spec?.flashcards?.[index]?.front) || `Kartička ${index + 1}`;
    case "memory_game": return text(spec?.memoryGame?.pairs?.[index]?.left) || `Dvojice ${index + 1}`;
    case "crossword": return text(spec?.crossword?.entries?.[index]?.clue) || `Slovo ${index + 1}`;
    case "reveal_cards": return text(spec?.revealCards?.cards?.[index]?.title) || `Karta ${index + 1}`;
    default: return `Položka ${index + 1}`;
  }
}

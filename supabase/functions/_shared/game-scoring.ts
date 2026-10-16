/**
 * Společná pravidla bodování živých her (obě cesty: submit-answer i
 * submit-activity-response). Čisté funkce bez Deno importů – testují se ve Vitestu.
 * Výchozí čísla jsou v GAME_RULES, aby šla změnit na jednom místě.
 */
export const GAME_RULES = {
  classic: { min: 400, max: 1000, defaultTimeSec: 20 },
  race: { correct: 10 },
  tower: { correct: 1 },
  steal: {
    base: 100,          // body za správnou odpověď
    pct: 0.1,           // ukradne se 10 % bodů oběti
    min: 50,            // aspoň 50 (pokud oběť tolik má)
    max: 300,           // nejvýš 300
    wrongPenalty: 100,  // za chybu −100, ale skóre nikdy pod 0
    robberStreak: 3,    // 3 správně v řadě = lupič, krade dvojnásobek
  },
} as const;

export type GameModeId = "standard" | "race" | "tower" | "steal";

export function normalizeMode(m: unknown): GameModeId {
  const s = String(m || "standard");
  return s === "race" || s === "tower" || s === "steal" ? s : "standard";
}

/** Režim pro snímek: per-slide override, kromě závodu (jen celá hra). */
export function effectiveMode(sessionMode: unknown, slideMode: unknown): GameModeId {
  const g = normalizeMode(sessionMode);
  if (g === "race") return "race";
  if (slideMode && String(slideMode) !== "race") return normalizeMode(slideMode);
  return g;
}

export function classicScore(correct: boolean, elapsedMs: number, timeLimitMs: number): number {
  if (!correct) return 0;
  const lim = timeLimitMs > 0 ? timeLimitMs : GAME_RULES.classic.defaultTimeSec * 1000;
  const ratio = Math.max(0, Math.min(1, 1 - Math.max(0, elapsedMs) / lim));
  return Math.round(GAME_RULES.classic.min + (GAME_RULES.classic.max - GAME_RULES.classic.min) * ratio);
}

/** Kolik se ukradne oběti se skóre `victimScore`. */
export function stealAmount(victimScore: number, robber: boolean): number {
  const v = Math.max(0, Math.floor(victimScore || 0));
  if (v <= 0) return 0;
  const r = GAME_RULES.steal;
  let amt = Math.min(r.max, Math.max(r.min, Math.round(v * r.pct)));
  if (robber) amt *= 2;
  return Math.min(v, amt);
}

/** Počet správných odpovědí v řadě (od nejnovější) včetně aktuální. */
export function correctStreak(previousNewestFirst: boolean[], currentCorrect: boolean): number {
  if (!currentCorrect) return 0;
  let n = 1;
  for (const c of previousNewestFirst) { if (!c) break; n++; }
  return n;
}

export interface Opponent { id: string; total_score: number | null; nickname?: string | null }
export interface Team { id: string; members: string[] }

/** Soupeři, ze kterých lze krást: ne já, ne spoluhráči z týmu. */
export function stealCandidates(meId: string, others: Opponent[], teams: Team[] | null | undefined, teamsActive: boolean): Opponent[] {
  let pool = others.filter((o) => o.id !== meId);
  if (teamsActive && teams?.length) {
    const my = teams.find((t) => Array.isArray(t.members) && t.members.includes(meId));
    if (my) { const mates = new Set(my.members); pool = pool.filter((o) => !mates.has(o.id)); }
  }
  return pool;
}

/** Oběť krádeže = vedoucí soupeř s kladným skóre (dohánění lídra); remíza → podle id. */
export function pickVictim(pool: Opponent[]): Opponent | null {
  const ok = pool.filter((o) => (o.total_score ?? 0) > 0);
  if (!ok.length) return null;
  return [...ok].sort((a, b) => (b.total_score ?? 0) - (a.total_score ?? 0) || a.id.localeCompare(b.id))[0];
}

export interface ScoreInput {
  mode: GameModeId;
  correct: boolean;
  elapsedMs: number;
  timeLimitMs: number;
  myScore: number;
  streak: number;          // včetně aktuální odpovědi
  victim: Opponent | null; // jen pro krádež
}
export interface ScoreResult { score: number; victimId: string | null; victimDelta: number; robber: boolean }

export function computeScore(i: ScoreInput): ScoreResult {
  const none = { victimId: null, victimDelta: 0, robber: false };
  switch (i.mode) {
    case "race": return { score: i.correct ? GAME_RULES.race.correct : 0, ...none };
    case "tower": return { score: i.correct ? GAME_RULES.tower.correct : 0, ...none };
    case "steal": {
      const r = GAME_RULES.steal;
      if (!i.correct) return { score: -Math.min(Math.max(0, i.myScore), r.wrongPenalty), ...none };
      const robber = i.streak >= r.robberStreak;
      const amt = i.victim ? stealAmount(i.victim.total_score ?? 0, robber) : 0;
      return { score: r.base + amt, victimId: amt > 0 ? i.victim!.id : null, victimDelta: -amt, robber };
    }
    default: return { score: classicScore(i.correct, i.elapsedMs, i.timeLimitMs), ...none };
  }
}

/** Správnost MCQ ze zvolených indexů (server nevěří telefonu). null = nelze ověřit. */
export function mcqCorrectFromSelection(options: unknown, selected: unknown): boolean | null {
  if (!Array.isArray(options) || !Array.isArray(selected)) return null;
  const correct = options.map((o: any, i) => (o?.correct || o?.isCorrect ? i : -1)).filter((i) => i >= 0);
  if (!correct.length) return null;
  const sel = [...new Set(selected.filter((x) => Number.isInteger(x)))].sort();
  return sel.length === correct.length && sel.every((x, k) => x === correct[k]);
}

export const teamsActiveFor = (slide: any, settings: any) =>
  String(slide?.gameSettings?.teamMode ?? settings?.teamModeKind ?? (settings?.teamMode ? "random" : "none")) !== "none";

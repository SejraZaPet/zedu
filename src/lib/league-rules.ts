/**
 * Čistá pravidla Bezli ligy v1. Zrcadlí SQL funkce add_xp a close_league_week —
 * autoritativní výpočet je vždy na serveru, tady jen pro testy a vysvětlení v UI.
 */
export const LEAGUE_RULES = {
  dailyCap: 150,
  repeatFactors: [1, 0.5, 0.2, 0] as const,
  streakBonus: { from3: 5, from7: 10 },
  groupSize: 30,
  promoteTop: 5,
  demoteBottom: 5,
  demoteMinGroup: 10,
  topVisible: 10,
} as const;

export const LEAGUE_TIERS = ["Bronz", "Stříbro", "Zlato", "Diamant"] as const;
export const tierName = (t: number) => LEAGUE_TIERS[Math.max(0, Math.min(3, t))] ?? "Bronz";

export const repeatFactor = (previousSameToday: number) =>
  LEAGUE_RULES.repeatFactors[Math.min(previousSameToday, 3)];

export const streakBonus = (streak: number, firstEventToday: boolean) =>
  !firstEventToday ? 0 : streak >= 7 ? LEAGUE_RULES.streakBonus.from7 : streak >= 3 ? LEAGUE_RULES.streakBonus.from3 : 0;

/** XP skutečně připsané jedním zápisem (stejně jako add_xp). */
export function awardedXp(opts: {
  base: number;
  previousSameToday: number;
  todaySum: number;
  streak: number;
  firstEventToday: boolean;
}): number {
  if (opts.base <= 0) return 0;
  const amt = Math.floor(opts.base * repeatFactor(opts.previousSameToday)) + streakBonus(opts.streak, opts.firstEventToday);
  return Math.max(0, Math.min(amt, LEAGUE_RULES.dailyCap - opts.todaySum));
}

export type WeekResult = "promoted" | "demoted" | "stay";
export function weekResult(rank: number, groupSize: number, xp: number, tier: number): WeekResult {
  if (rank <= LEAGUE_RULES.promoteTop && xp > 0 && tier < 3) return "promoted";
  if (groupSize >= LEAGUE_RULES.demoteMinGroup && rank > groupSize - LEAGUE_RULES.demoteBottom && tier > 0) return "demoted";
  return "stay";
}

/** Body třídy = průměr XP aktivních členů (alespoň 1 XP v týdnu). */
export function classAverage(memberXp: number[]): number {
  const active = memberXp.filter((x) => x > 0);
  if (!active.length) return 0;
  return Math.round((active.reduce((a, b) => a + b, 0) / active.length) * 10) / 10;
}

/** Co smí žák vidět: top 10 s body a sebe. */
export function visibleRows<T extends { rank: number; xp: number; isMe: boolean }>(rows: T[]): T[] {
  return rows.filter((r) => r.isMe || (r.rank <= LEAGUE_RULES.topVisible && r.xp > 0));
}

/** Konec ligového týdne = příští pondělí 00:00 v Praze. */
export function weekEnd(weekStart: string): Date {
  const [y, m, d] = weekStart.split("-").map(Number);
  const midnight = Date.UTC(y, m - 1, d + 7);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(midnight));
  const offsetHours = Number(parts.find((part) => part.type === "hour")?.value ?? 1);
  return new Date(midnight - offsetHours * 3600000);
}

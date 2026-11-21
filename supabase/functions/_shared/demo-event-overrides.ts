// Servrová výjimka pro události. Řádek pochází výhradně z service-only demo_event_config,
// nikdy z limitů poslaných klientem. Neznámý, změněný nebo neplatný štítek nic nezvýší.
export interface DemoEventOverride {
  tag: string;
  active_from: string;
  active_until: string; // výhradní konec: 2026-12-15 00:00 Praha = poslední den 14. 12.
  create_per_ip_hour: number;
  create_global_day: number;
  ai_per_account: number;
  ai_daily_global: number;
  materials_max: number;
  live_players_max: number;
  upload_max_files: number;
  upload_max_bytes: number;
}

export const DEMO_CREATION_DEFAULTS = { perIpHour: 20, globalDay: 500 } as const;

const LIMIT_KEYS = [
  "create_per_ip_hour", "create_global_day", "ai_per_account", "ai_daily_global",
  "materials_max", "live_players_max", "upload_max_files", "upload_max_bytes",
] as const;

/** Přesná shoda štítku, platnost času a kladné limity; při pochybnosti se nepoužije výjimka. */
export function resolveDemoEventOverride(
  tag: string | null,
  value: unknown,
  now: Date = new Date(),
): DemoEventOverride | null {
  if (!tag || !value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (row.tag !== tag) return null;
  const from = Date.parse(String(row.active_from ?? ""));
  const until = Date.parse(String(row.active_until ?? ""));
  if (!Number.isFinite(from) || !Number.isFinite(until) || until <= from) return null;
  if (now.getTime() < from || now.getTime() >= until) return null;
  for (const key of LIMIT_KEYS) {
    if (!Number.isFinite(Number(row[key])) || Number(row[key]) <= 0) return null;
  }
  return {
    tag,
    active_from: String(row.active_from),
    active_until: String(row.active_until),
    ...Object.fromEntries(LIMIT_KEYS.map((key) => [key, Number(row[key])])),
  } as DemoEventOverride;
}

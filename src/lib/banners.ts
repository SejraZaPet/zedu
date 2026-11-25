import { supabase } from "@/integrations/supabase/client";

export interface Banner {
  id: string;
  scope: "platform" | "school";
  school_id: string | null;
  media_type: "image" | "video";
  image_path: string | null;
  video_path: string | null;
  poster_path: string | null;
  alt_text: string;
  link_url: string | null;
  target_students: boolean;
  target_teachers: boolean;
  target_leadership: boolean;
  display_seconds: number;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  is_active: boolean;
  hidden_by_admin: boolean;
  created_at?: string;
}

export const BANNER_BUCKET = "banners";
export const DISMISS_KEY = "bezli.banner.dismissed";
export const DISMISS_MS = 7 * 24 * 3600 * 1000;
export const MAX_VIDEO_LOOPS = 2;

export function bannerPublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  // Local previews (blob:/data:) and already-resolved URLs pass through unchanged.
  if (/^(blob:|data:|https?:\/\/)/i.test(path)) return path;
  return supabase.storage.from(BANNER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type BannerStatus = "ceka" | "bezi" | "vyprsel" | "vypnuty" | "skryto";
export const BANNER_STATUS_LABEL: Record<BannerStatus, string> = {
  ceka: "Čeká", bezi: "Běží", vyprsel: "Vypršel", vypnuty: "Vypnutý", skryto: "Skryto",
};

export function bannerStatus(b: Pick<Banner, "is_active" | "hidden_by_admin" | "starts_at" | "ends_at">, now = Date.now()): BannerStatus {
  if (b.hidden_by_admin) return "skryto";
  if (b.ends_at && new Date(b.ends_at).getTime() <= now) return "vyprsel";
  if (!b.is_active) return "vypnuty";
  if (b.starts_at && new Date(b.starts_at).getTime() > now) return "ceka";
  return "bezi";
}

export function isSafeHttpsUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /^https:\/\/[^\s]+$/.test(url);
  } catch {
    return false;
  }
}

type DismissMap = Record<string, number>;

export const SEEN_NEWS_KEY = "bezli.banner.seen";
/** Fired whenever dismissed/seen state changes, so the carousel and the Novinky badge stay in sync. */
export const BANNERS_CHANGE_EVENT = "bezli:banners-change";
const MAX_STORED = 200;

function readMap(key: string): DismissMap {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(key: string, map: DismissMap): void {
  try {
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, MAX_STORED);
    window.localStorage.setItem(key, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* localStorage nedostupné – platí jen do obnovení stránky */
  }
}

function notifyChange(): void {
  try { window.dispatchEvent(new Event(BANNERS_CHANGE_EVENT)); } catch { /* ignore */ }
}

/** @deprecated Skrytí už nevyprší po 7 dnech; ponecháno pro kompatibilitu. */
export function dismissUntil(endsAt: string | null, now = Date.now()): number {
  const week = now + DISMISS_MS;
  if (!endsAt) return week;
  const end = new Date(endsAt).getTime();
  return Number.isFinite(end) ? Math.min(week, end) : week;
}

/**
 * Skryje banner na tomto zařízení natrvalo – dokud nepřijde banner s jiným id
 * nebo dokud uživatel neklikne na Novinky. (Starší záznamy s časem platí také.)
 */
export function dismissBanner(id: string, _endsAt?: string | null, now = Date.now()): void {
  dismissBanners([id], now);
}

export function dismissBanners(ids: string[], now = Date.now()): void {
  const map = readMap(DISMISS_KEY);
  for (const id of ids) map[id] = now;
  writeMap(DISMISS_KEY, map);
  notifyChange();
}

export function isDismissed(id: string): boolean {
  return typeof readMap(DISMISS_KEY)[id] === "number";
}

export function filterDismissed<T extends { id: string }>(list: T[], _now = Date.now()): T[] {
  const map = readMap(DISMISS_KEY);
  return list.filter((b) => typeof map[b.id] !== "number");
}

/** Počet nových novinek: neskryté a dosud neotevřené přes tlačítko Novinky. */
export function countNewBanners<T extends { id: string }>(list: T[]): number {
  const seen = readMap(SEEN_NEWS_KEY);
  return filterDismissed(list).filter((b) => typeof seen[b.id] !== "number").length;
}

export function markBannersSeen(ids: string[], now = Date.now()): void {
  const map = readMap(SEEN_NEWS_KEY);
  for (const id of ids) map[id] = now;
  writeMap(SEEN_NEWS_KEY, map);
  notifyChange();
}

/** Tlačítko Novinky: vrátí skryté bannery zpět. */
export function clearDismissedBanners(): void {
  try { window.localStorage.removeItem(DISMISS_KEY); } catch { /* storage unavailable */ }
  notifyChange();
}

/** Převod chyb databáze na srozumitelnou hlášku. */
export function bannerErrorMessage(err: { message?: string; code?: string } | null | undefined): string {
  const msg = err?.message ?? "";
  if (/nejvýš \d+ aktivní|smí správce|nelze přesunout|smí měnit jen/.test(msg)) return msg;
  if (err?.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Tuto změnu nemáte oprávnění provést.";
  }
  if (/bucket not found/i.test(msg)) return "Úložiště bannerů zatím není připravené.";
  return msg || "Něco se nepovedlo. Zkuste to prosím znovu.";
}

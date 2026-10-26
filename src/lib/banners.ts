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

function readDismissed(): DismissMap {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function dismissUntil(endsAt: string | null, now = Date.now()): number {
  const week = now + DISMISS_MS;
  if (!endsAt) return week;
  const end = new Date(endsAt).getTime();
  return Number.isFinite(end) ? Math.min(week, end) : week;
}

export function dismissBanner(id: string, endsAt: string | null, now = Date.now()): void {
  try {
    const map = readDismissed();
    for (const k of Object.keys(map)) if (!(map[k] > now)) delete map[k];
    map[id] = dismissUntil(endsAt, now);
    window.localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    /* localStorage nedostupné – skrytí platí jen do obnovení stránky */
  }
}

export function filterDismissed<T extends { id: string }>(list: T[], now = Date.now()): T[] {
  const map = readDismissed();
  return list.filter((b) => !(typeof map[b.id] === "number" && map[b.id] > now));
}

/** Převod chyb databáze na srozumitelnou hlášku. */
export function bannerErrorMessage(err: { message?: string; code?: string } | null | undefined): string {
  const msg = err?.message ?? "";
  if (/nejvýš 3 aktivní|smí správce|nelze přesunout|smí měnit jen/.test(msg)) return msg;
  if (err?.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return "Tuto změnu nemáte oprávnění provést.";
  }
  if (/bucket not found/i.test(msg)) return "Úložiště bannerů zatím není připravené.";
  return msg || "Něco se nepovedlo. Zkuste to prosím znovu.";
}

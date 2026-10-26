import { supabase } from "@/integrations/supabase/client";
import { BANNER_BUCKET } from "@/lib/banners";

export const BANNER_MAX_BYTES = 3 * 1024 * 1024;
export const BANNER_MAX_VIDEO_SECONDS = 10;
export const BANNER_SIZES: Array<[number, number]> = [[1500, 500], [1584, 396], [1920, 480]];
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateBannerFile(file: { type: string; size: number }, kind: "image" | "video"): string | null {
  if (kind === "image" && !IMAGE_TYPES.includes(file.type)) return "Obrázek musí být JPG, PNG nebo WebP.";
  if (kind === "video" && file.type !== "video/mp4") return "Video musí být ve formátu MP4 (H.264).";
  if (file.size > BANNER_MAX_BYTES) return "Soubor je větší než 3 MB.";
  return null;
}

/** Accepts 1500×500, 1584×396, 1920×480 or any size with the same ratio (±2 %). */
export function validateBannerDimensions(w: number, h: number): string | null {
  if (!w || !h) return "Nepodařilo se zjistit rozměry souboru.";
  const r = w / h;
  const ok = BANNER_SIZES.some(([bw, bh]) => Math.abs(r - bw / bh) / (bw / bh) <= 0.02);
  return ok ? null : `Rozměr ${w}×${h} px nesedí. Použijte 1500×500, 1584×396 nebo 1920×480 px.`;
}

export function validateVideoDuration(seconds: number): string | null {
  if (!Number.isFinite(seconds) || seconds <= 0) return "Nepodařilo se zjistit délku videa.";
  return seconds > BANNER_MAX_VIDEO_SECONDS + 0.05 ? "Video může mít nejvýš 10 sekund." : null;
}

export interface BannerFormValues {
  alt_text: string;
  link_url: string;
  display_seconds: number;
  starts_at: string;
  ends_at: string;
  target_students: boolean;
  target_teachers: boolean;
  target_leadership: boolean;
}

export function validateBannerForm(v: BannerFormValues): string | null {
  const alt = v.alt_text.trim();
  if (alt.length < 3 || alt.length > 200) return "Popis obrázku (alt) musí mít 3–200 znaků.";
  if (v.link_url.trim() && !/^https:\/\/[^\s]+$/.test(v.link_url.trim())) return "Odkaz musí začínat https:// a nesmí obsahovat mezery.";
  if (!Number.isInteger(v.display_seconds) || v.display_seconds < 3 || v.display_seconds > 60) return "Doba zobrazení musí být 3–60 sekund.";
  if (v.starts_at && v.ends_at && new Date(v.ends_at) <= new Date(v.starts_at)) return "Konec platnosti musí být po začátku.";
  if (!v.target_students && !v.target_teachers && !v.target_leadership) return "Vyberte alespoň jednu skupinu.";
  return null;
}

export function bannerFolder(scope: "platform" | "school", schoolId: string | null): string {
  return scope === "platform" ? "platform" : `school/${schoolId}`;
}

export function bannerFilePath(folder: string, file: { name?: string; type: string }): string {
  const ext = file.type === "video/mp4" ? "mp4" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  return `${folder}/${crypto.randomUUID()}.${ext}`;
}

export function readImageSize(file: Blob): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Obrázek nelze načíst.")); };
    img.src = url;
  });
}

export function readVideoMeta(file: Blob): Promise<{ w: number; h: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.onloadedmetadata = () => { resolve({ w: v.videoWidth, h: v.videoHeight, duration: v.duration }); URL.revokeObjectURL(url); };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Video nelze načíst.")); };
    v.src = url;
  });
}

/** Poster from the first frame (0.1 s) via canvas. */
export function posterFromVideo(file: Blob): Promise<File> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => { v.currentTime = Math.min(0.1, v.duration || 0.1); };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext("2d")?.drawImage(v, 0, 0);
      c.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (!b) return reject(new Error("Náhled z videa se nepodařilo vytvořit."));
        resolve(new File([b], "poster.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.85);
    };
    v.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Video nelze načíst.")); };
    v.src = url;
  });
}

export function canPlayH264(): boolean {
  try { return document.createElement("video").canPlayType('video/mp4; codecs="avc1.42E01E"') !== ""; } catch { return true; }
}

export async function uploadBannerFile(path: string, file: Blob): Promise<void> {
  const { error } = await supabase.storage.from(BANNER_BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (error) throw error;
}

/** Removes files; failures are reported, never thrown. */
export async function removeBannerFiles(paths: Array<string | null | undefined>): Promise<boolean> {
  const list = paths.filter((p): p is string => !!p);
  if (!list.length) return true;
  const { error } = await supabase.storage.from(BANNER_BUCKET).remove(list);
  return !error;
}

/** Old paths no longer referenced after a replace. */
export function stalePaths(oldPaths: Array<string | null>, newPaths: Array<string | null>): string[] {
  const keep = new Set(newPaths.filter(Boolean));
  return oldPaths.filter((p): p is string => !!p && !keep.has(p));
}

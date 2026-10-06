import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET, type TeacherMediaItem } from "@/lib/teacher-media";
import { PUBLIC_IMAGE_BUCKET, isSignedTeacherMediaUrl, persistSlideImageUrl } from "@/lib/slide-image-persist";
import type { LessonVisualBlock } from "@/lib/lesson-content-splitter";
import type { WorksheetItem } from "@/lib/worksheet-spec";

/**
 * Obrázky pracovních listů používají stejný mechanismus jako prezentace:
 * trvalá veřejná URL v bucketu `lesson-images` (žák ji vidí, nevyprší).
 */
export const WORKSHEET_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp"];

/** Nahraje obrázek z počítače / schránky a vrátí trvalou veřejnou URL. */
export async function uploadWorksheetImage(file: File, userId: string | undefined): Promise<string> {
  const ext = (file.name.split(".").pop() || file.type.split("/")[1] || "png").toLowerCase();
  if (!file.type.startsWith("image/") && !IMAGE_EXT.includes(ext)) {
    throw new Error("Vložte prosím obrázek (JPG, PNG, GIF nebo WEBP).");
  }
  if (file.size > WORKSHEET_IMAGE_MAX_BYTES) {
    throw new Error("Obrázek je větší než 10 MB.");
  }
  const safeExt = IMAGE_EXT.includes(ext) ? ext : "png";
  const path = `worksheets/${userId || "unknown"}/${crypto.randomUUID()}.${safeExt}`;
  const { error } = await supabase.storage
    .from(PUBLIC_IMAGE_BUCKET)
    .upload(path, file, { contentType: file.type || `image/${safeExt}`, upsert: false });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Z podepsané URL privátní knihovny vytáhne cestu k souboru. */
export function teacherMediaPathFromSignedUrl(url: string): string | null {
  const marker = `/storage/v1/object/sign/${MEDIA_BUCKET}/`;
  const i = url.indexOf(marker);
  if (i < 0) return null;
  const rest = url.slice(i + marker.length).split("?")[0];
  try {
    return decodeURIComponent(rest) || null;
  } catch {
    return rest || null;
  }
}

/**
 * Vrátí trvalou URL pro uložení do listu. Obrázek z privátní knihovny
 * (podepsaná URL, platí 1 h) se zkopíruje do veřejného bucketu.
 */
export async function persistWorksheetImageUrl(
  url: string,
  item: TeacherMediaItem | undefined,
  userId: string | undefined,
): Promise<string> {
  if (!isSignedTeacherMediaUrl(url)) return url;
  const storage_path = item?.storage_path || teacherMediaPathFromSignedUrl(url) || undefined;
  return persistSlideImageUrl(url, { ...(item ?? {}), storage_path } as TeacherMediaItem, userId);
}

/**
 * AI někdy vrátí obrazové položky bez adresy obrázku. Doplní jim obrázky
 * z lekce v pořadí lekce; položky s vyplněnou adresou nemění.
 */
export function fillLessonVisualImages(
  items: WorksheetItem[],
  visuals: LessonVisualBlock[],
): WorksheetItem[] {
  const pool = visuals
    .map((v) =>
      v.kind === "image"
        ? { url: v.url, alt: v.alt ?? v.caption ?? "" }
        : v.kind === "image_text" && v.imageUrl
          ? { url: v.imageUrl, alt: "" }
          : null,
    )
    .filter((x): x is { url: string; alt: string } => !!x && !!x.url);
  const used = new Set(items.map((it) => it.imageUrl).filter(Boolean));
  const available = pool.filter((p) => !used.has(p.url));
  return items.map((it) => {
    if ((it.type === "image" || it.type === "image_text") && !it.imageUrl) {
      const next = available.shift();
      if (next) return { ...it, imageUrl: next.url, imageAlt: it.imageAlt || next.alt };
    }
    return it;
  });
}

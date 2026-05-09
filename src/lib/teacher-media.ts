import { supabase } from "@/integrations/supabase/client";

export interface TeacherMediaItem {
  id: string;
  teacher_id: string;
  filename: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export const MEDIA_BUCKET = "teacher-media";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_MIME = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/mpeg",
  "audio/mp3",
  "video/mp4",
];
export const ACCEPTED_EXT = ["jpg", "jpeg", "png", "gif", "webp", "pdf", "mp3", "mp4"];

export function isImage(mime: string) {
  return mime.startsWith("image/");
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function validateFile(file: File): string | null {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXT.includes(ext)) {
    return `Nepodporovaný formát .${ext}. Povolené: ${ACCEPTED_EXT.join(", ")}`;
  }
  if (file.size > MAX_FILE_BYTES) {
    return `Soubor je větší než 10 MB (${formatBytes(file.size)}).`;
  }
  return null;
}

/** Get a signed URL valid for 1h (private bucket). */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Upload one file under the user's folder, then insert DB row. */
export async function uploadMedia(
  file: File,
  teacherId: string,
  tags: string[] = [],
): Promise<TeacherMediaItem> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  const path = `${teacherId}/${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const { data, error } = await supabase
    .from("teacher_media")
    .insert({
      teacher_id: teacherId,
      filename: file.name,
      storage_path: path,
      mime_type: file.type || "application/octet-stream",
      size_bytes: file.size,
      tags,
    })
    .select()
    .single();
  if (error) {
    // best-effort cleanup
    await supabase.storage.from(MEDIA_BUCKET).remove([path]);
    throw error;
  }
  return data as TeacherMediaItem;
}

export async function deleteMedia(item: TeacherMediaItem): Promise<void> {
  await supabase.storage.from(MEDIA_BUCKET).remove([item.storage_path]);
  await supabase.from("teacher_media").delete().eq("id", item.id);
}

export async function renameMedia(id: string, filename: string): Promise<void> {
  const { error } = await supabase
    .from("teacher_media")
    .update({ filename })
    .eq("id", id);
  if (error) throw error;
}

export async function setMediaTags(id: string, tags: string[]): Promise<void> {
  const { error } = await supabase.from("teacher_media").update({ tags }).eq("id", id);
  if (error) throw error;
}

export async function listMedia(teacherId: string): Promise<TeacherMediaItem[]> {
  const { data, error } = await supabase
    .from("teacher_media")
    .select("*")
    .eq("teacher_id", teacherId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TeacherMediaItem[];
}

/**
 * Generate a small JPEG thumbnail on the client using canvas.
 * Returns null when the file is not an image or rendering fails.
 * @param maxSize max width/height in px
 */
export async function generateImageThumbnail(file: File, maxSize = 320): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
    const w = Math.round(img.width * ratio);
    const h = Math.round(img.height * ratio);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78),
    );
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

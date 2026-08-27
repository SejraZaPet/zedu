import { supabase } from "@/integrations/supabase/client";
import { MEDIA_BUCKET, type TeacherMediaItem } from "@/lib/teacher-media";

/** Veřejný bucket pro trvalé obrázky (stejný jako herní pozadí / Akademie). */
export const PUBLIC_IMAGE_BUCKET = "lesson-images";

/**
 * Vrátí trvalou veřejnou URL obrázku pro uložení do dat slidu.
 *
 * Obrázek z privátní knihovny učitele (`teacher-media`) se zkopíruje do
 * veřejného bucketu `lesson-images`, protože podepsaná URL po hodině vyprší.
 * Obrázky z herních pozadí a Unsplash se vrací beze změny – už jsou trvalé.
 *
 * @throws když se kopírování nepodaří (volající zobrazí toast a nic nevloží)
 */
export async function persistSlideImageUrl(
  url: string,
  item: TeacherMediaItem | undefined,
  userId: string | undefined,
): Promise<string> {
  const storagePath = item?.storage_path;
  if (!storagePath || !isSignedTeacherMediaUrl(url)) return url;

  const { data: file, error: dlError } = await supabase.storage
    .from(MEDIA_BUCKET)
    .download(storagePath);
  if (dlError || !file) {
    throw new Error(dlError?.message || "Soubor se nepodařilo načíst z knihovny médií.");
  }

  const ext = storagePath.split(".").pop()?.toLowerCase() || "jpg";
  const targetPath = `presentations/${userId || "unknown"}/${crypto.randomUUID()}.${ext}`;
  const { error: upError } = await supabase.storage
    .from(PUBLIC_IMAGE_BUCKET)
    .upload(targetPath, file, {
      contentType: item?.mime_type || file.type || "image/jpeg",
      upsert: false,
    });
  if (upError) throw new Error(upError.message);

  const { data } = supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(targetPath);
  if (!data?.publicUrl) throw new Error("Trvalý odkaz se nepodařilo vygenerovat.");
  return data.publicUrl;
}

/** Rozpozná podepsanou (časově omezenou) URL z privátního bucketu teacher-media. */
export function isSignedTeacherMediaUrl(url: string): boolean {
  return url.includes(`/storage/v1/object/sign/${MEDIA_BUCKET}/`);
}

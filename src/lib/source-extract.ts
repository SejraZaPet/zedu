/** Jedna cesta extrakce textu podle druhu zdroje (etapa 0). Nic neukládá. */
import { supabase } from "@/integrations/supabase/client";
import { extractDocumentText } from "@/lib/curriculum-file-extract";
import { disposePracticePhoto, preparePracticePhoto, PRACTICE_PHOTO_UNREADABLE_MESSAGE } from "@/lib/practice-photo";
import { practiceErrorMessage } from "@/lib/practice-error";
import { urlErrorMessage, type SourceKind } from "@/lib/source-bundle";

export async function extractFileSource(file: File, kind: SourceKind): Promise<string> {
  if (kind === "txt") return (await file.text()).trim();
  if (kind === "photo") {
    const photo = await preparePracticePhoto(file);
    try {
      const { data, error } = await supabase.functions.invoke("extract-practice-photo-text", {
        body: { imageBase64: photo.imageBase64, mimeType: photo.mimeType },
      });
      if (error) throw new Error(await practiceErrorMessage(error));
      const text = typeof (data as any)?.text === "string" ? (data as any).text.trim() : "";
      if ((data as any)?.error || !text) throw new Error(PRACTICE_PHOTO_UNREADABLE_MESSAGE);
      return text;
    } finally {
      disposePracticePhoto(photo);
    }
  }
  return extractDocumentText(file);
}

export async function extractUrlSource(url: string): Promise<{ text: string; origin: string; note?: string }> {
  const { data, error } = await supabase.functions.invoke("fetch-source-url", { body: { url } });
  let code: unknown = (data as any)?.error;
  if (error) {
    try { code = (await (error as any).context?.json?.())?.error ?? code; } catch { /* */ }
    throw new Error(urlErrorMessage(code));
  }
  if (code) throw new Error(urlErrorMessage(code));
  const d = data as any;
  if (d?.kind === "pdf" && typeof d.base64 === "string") {
    const bin = Uint8Array.from(atob(d.base64), (c) => c.charCodeAt(0));
    const file = new File([bin], d.fileName || "odkaz.pdf", { type: "application/pdf" });
    return { text: await extractDocumentText(file), origin: String(d.origin ?? "") };
  }
  return {
    text: String(d?.text ?? ""),
    origin: String(d?.origin ?? ""),
    note: d?.truncated ? "Stránka je velmi dlouhá – načtena jen část. Text zkraťte na podstatné." : undefined,
  };
}

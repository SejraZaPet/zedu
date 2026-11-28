/** Jedna cesta extrakce textu podle druhu zdroje (etapa 0). Nic neukládá. */
import { supabase } from "@/integrations/supabase/client";
import { extractDocumentText } from "@/lib/curriculum-file-extract";
import { disposePracticePhoto, preparePracticePhoto, PRACTICE_PHOTO_UNREADABLE_MESSAGE } from "@/lib/practice-photo";
import { practiceErrorMessage, readablePracticeMessage } from "@/lib/practice-error";
import { isCloudLoginHost, urlErrorMessage, type SourceKind } from "@/lib/source-bundle";
import { EMPTY_FILE_MESSAGE, extractDocx, extractOdf, extractPptx, extractXlsx, legacyFormatHint } from "@/lib/office-extract";
import { extractPdfText, renderPdfPagesToImages } from "@/lib/pdf-page-renderer";
import { SCANNED_PDF_HINT, SCANNED_PDF_MAX_CHARS } from "@/lib/lesson-or-own-source";

/** PDF bez textové vrstvy – UI nabídne zpracování stránek jako fotek. */
export class ScannedPdfError extends Error {
  constructor() { super(SCANNED_PDF_HINT); this.name = "ScannedPdfError"; }
}

const nonEmpty = (t: string) => { const c = t.trim(); if (!c) throw new Error(EMPTY_FILE_MESSAGE); return c; };

/** Stránky PDF jako JPEG soubory (pro OCR jako fotky). */
export async function pdfPagesAsPhotos(file: File, max: number): Promise<{ files: File[]; total: number }> {
  const urls = await renderPdfPagesToImages(file);
  const base = file.name.replace(/\.pdf$/i, "");
  const files = await Promise.all(urls.slice(0, max).map(async (u, i) => {
    const blob = await (await fetch(u)).blob();
    return new File([blob], `${base} – strana ${i + 1}.jpg`, { type: blob.type || "image/jpeg" });
  }));
  return { files, total: urls.length };
}

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
      if ((data as any)?.error) throw new Error(readablePracticeMessage((data as any).error));
      if (!text) throw new Error(PRACTICE_PHOTO_UNREADABLE_MESSAGE);
      return text;
    } finally {
      disposePracticePhoto(photo);
    }
  }
  if (file.size === 0) throw new Error(EMPTY_FILE_MESSAGE);
  const lower = file.name.toLowerCase();
  const legacy = legacyFormatHint(lower);
  if (legacy) throw new Error(legacy);
  if (kind === "pdf") {
    let text = "";
    try { text = (await extractPdfText(file)).text ?? ""; } catch {
      throw new Error("PDF se nepodařilo otevřít – je možná poškozené nebo chráněné heslem. Uložte ho znovu, nebo text vložte ručně.");
    }
    if (text.trim().length < SCANNED_PDF_MAX_CHARS) throw new ScannedPdfError();
    return text.trim();
  }
  if (kind === "pptx") return nonEmpty(await extractPptx(file));
  if (kind === "xlsx") return nonEmpty(await extractXlsx(file));
  if (kind === "odt") return nonEmpty(await extractOdf(file));
  if (kind === "docx" && lower.endsWith(".docx")) return nonEmpty(await extractDocx(file));
  return extractDocumentText(file); // .doc – stávající heuristika s radou „uložte jako DOCX/PDF“
}

export async function extractUrlSource(url: string): Promise<{ text: string; origin: string; note?: string }> {
  try {
    const h = new URL(url).hostname.toLowerCase();
    if (isCloudLoginHost(url)) throw new Error(urlErrorMessage("CLOUD_LOGIN"));
    if (/(^|\.)canva\.(site|com)$/.test(h)) throw new Error(urlErrorMessage("CANVA"));
  } catch (e) { if (e instanceof Error && (e.message === urlErrorMessage("CANVA") || e.message === urlErrorMessage("CLOUD_LOGIN"))) throw e; }
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

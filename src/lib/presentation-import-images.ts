import { supabase } from "@/integrations/supabase/client";
import { PUBLIC_IMAGE_BUCKET } from "@/lib/slide-image-persist";

export const IMPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const IMPORT_TOTAL_MAX_BYTES = 60 * 1024 * 1024;
export const IMPORT_IMAGE_MAX_SIDE = 2560;

export type ImportedImageKind = "png" | "jpg" | "gif" | "webp";

export async function readBlobArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof (blob as any).arrayBuffer === "function") return (blob as any).arrayBuffer();
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result as ArrayBuffer); reader.onerror = () => reject(new Error("Soubor se nepodařilo načíst.")); reader.readAsArrayBuffer(blob); });
}

/** Formát určují bajty souboru, ne přípona ani deklarované MIME. */
export function sniffImportedImage(bytes: Uint8Array): { kind: ImportedImageKind; mime: string } | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return { kind: "png", mime: "image/png" };
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { kind: "jpg", mime: "image/jpeg" };
  if (bytes.length >= 6 && String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/)) return { kind: "gif", mime: "image/gif" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { kind: "webp", mime: "image/webp" };
  return null;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  if (globalThis.crypto?.subtle) {
    const copy = new Uint8Array(bytes);
    const digest = await globalThis.crypto.subtle.digest("SHA-256", copy.buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Deterministická záloha pro staré prohlížeče/testy; deduplikace je stále v rámci jednoho importu.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (const b of bytes) { h1 = Math.imul(h1 ^ b, 2654435761); h2 = Math.imul(h2 ^ b, 1597334677); }
  return `${(h1 >>> 0).toString(16)}${(h2 >>> 0).toString(16)}-${bytes.length}`;
}

async function resizeIfNeeded(blob: Blob, kind: ImportedImageKind): Promise<Blob> {
  // GIF nepřekreslujeme, jinak bychom ztratili animaci.
  if (kind === "gif" || typeof document === "undefined" || typeof createImageBitmap !== "function") return blob;
  try {
    const bitmap = await createImageBitmap(blob);
    if (Math.max(bitmap.width, bitmap.height) <= IMPORT_IMAGE_MAX_SIDE) { bitmap.close(); return blob; }
    const scale = IMPORT_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) { bitmap.close(); return blob; }
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const resized = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, blob.type || "image/png", 0.92));
    return resized && resized.size <= IMPORT_IMAGE_MAX_BYTES ? resized : blob;
  } catch {
    return blob; // Původní ověřený obrázek je bezpečnější než ztráta obsahu.
  }
}

export interface PreparedImportedImage { blob: Blob; kind: ImportedImageKind; hash: string; bytes: number }

export async function prepareImportedImage(bytes: Uint8Array): Promise<PreparedImportedImage> {
  if (bytes.byteLength > IMPORT_IMAGE_MAX_BYTES) throw new Error("Obrázek přesahuje 10 MB.");
  const detected = sniffImportedImage(bytes);
  if (!detected) throw new Error("Nepodporovaný obrázek (SVG, EMF, WMF nebo neznámý formát).");
  const hash = await sha256Hex(bytes);
  const original = new Blob([new Uint8Array(bytes)], { type: detected.mime });
  const blob = await resizeIfNeeded(original, detected.kind);
  return { blob, kind: detected.kind, hash, bytes: bytes.byteLength };
}

export type PresentationImageUpload = (image: PreparedImportedImage) => Promise<string>;

export function createPresentationImageUploader(userId: string | undefined, importId = crypto.randomUUID()): PresentationImageUpload {
  return async ({ blob, kind, hash }) => {
    if (!userId) throw new Error("Pro uložení obrázků musíte být přihlášeni.");
    const path = `presentations/${userId}/${importId}-${hash.slice(0, 24)}.${kind}`;
    const { error } = await supabase.storage.from(PUBLIC_IMAGE_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
    if (error && !/already exists|duplicate/i.test(error.message)) throw new Error(error.message);
    const { data } = supabase.storage.from(PUBLIC_IMAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Trvalý odkaz na obrázek se nepodařilo vytvořit.");
    return data.publicUrl;
  };
}

/** Jedna instance na celý import: hlídá 60MB a stejný obsah nahraje jen jednou. */
export class PresentationImageImportCache {
  private readonly urls = new Map<string, Promise<string>>();
  private consumed = 0;
  constructor(private readonly upload: PresentationImageUpload, private readonly totalLimit = IMPORT_TOTAL_MAX_BYTES) {}

  remainingBytes() { return Math.max(0, this.totalLimit - this.consumed); }

  async import(bytes: Uint8Array): Promise<string> {
    const prepared = await prepareImportedImage(bytes);
    const existing = this.urls.get(prepared.hash);
    if (existing) return existing;
    if (this.consumed + prepared.bytes > this.totalLimit) throw new Error("Obrázky přesáhly celkový limit 60 MB na import.");
    this.consumed += prepared.bytes;
    const pending = this.upload(prepared);
    this.urls.set(prepared.hash, pending);
    try { return await pending; } catch (error) { this.urls.delete(prepared.hash); this.consumed -= prepared.bytes; throw error; }
  }
}

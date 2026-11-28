import { AUDIO_VIDEO_SOURCE_MESSAGE, isAudioVideoFile } from "@/lib/source-bundle";

export const PRACTICE_PHOTO_INPUT_MAX_BYTES = 15 * 1024 * 1024;
export const PRACTICE_PHOTO_OUTPUT_MAX_BYTES = 4 * 1024 * 1024;
export const PRACTICE_PHOTO_MAX_DIMENSION = 2048;
export const PRACTICE_PHOTO_JPEG_QUALITY = 0.85;

export const PRACTICE_PHOTO_PRIVACY_NOTICE =
  "Fotku použijeme jen k přečtení textu a v Bezli ji neuložíme. Vyfoť jen učivo, bez jmen, obličejů a dalších osobních údajů. Používej pouze materiál, který smíš použít k vlastnímu studiu.";

export const PRACTICE_PHOTO_HEIC_MESSAGE =
  "Fotku HEIC se v tomto prohlížeči nepodařilo otevřít. Zkus ji nahrát jako JPEG, nebo v telefonu vyber pro fotografování formát JPEG.";

export const PRACTICE_PHOTO_UNREADABLE_MESSAGE =
  "Text se nepodařilo spolehlivě přečíst. Vyfot stránku znovu ostřeji a při lepším světle, nebo text opiš ručně.";

export type PracticePhotoErrorCode =
  | "INVALID_TYPE"
  | "INPUT_TOO_LARGE"
  | "DECODE_FAILED"
  | "HEIC_UNSUPPORTED"
  | "OUTPUT_TOO_LARGE";

export class PracticePhotoError extends Error {
  constructor(public readonly code: PracticePhotoErrorCode, message: string) {
    super(message);
    this.name = "PracticePhotoError";
  }
}

export type PreparedPracticePhoto = {
  imageBase64: string;
  mimeType: "image/jpeg";
  previewUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
};

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

function extension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isHeic(file: Pick<File, "name" | "type">): boolean {
  return file.type === "image/heic" || file.type === "image/heif" || ["heic", "heif"].includes(extension(file.name));
}

export function validatePracticePhotoFile(file: Pick<File, "name" | "type" | "size">, maxInputBytes = PRACTICE_PHOTO_INPUT_MAX_BYTES): void {
  if (isAudioVideoFile(file)) throw new PracticePhotoError("INVALID_TYPE", AUDIO_VIDEO_SOURCE_MESSAGE);
  const allowed = IMAGE_TYPES.has(file.type) || (!file.type && IMAGE_EXTENSIONS.has(extension(file.name)));
  if (!allowed) {
    throw new PracticePhotoError("INVALID_TYPE", "Vyber fotku ve formátu JPEG, PNG, WebP nebo HEIC.");
  }
  if (file.size <= 0) {
    throw new PracticePhotoError("DECODE_FAILED", "Fotka je prázdná. Vyber ji znovu.");
  }
  if (file.size > maxInputBytes) {
    throw new PracticePhotoError("INPUT_TOO_LARGE", `Fotka je větší než ${Math.round(maxInputBytes / 1048576)} MB. Zmenši ji nebo vyber jinou.`);
  }
}

export function practicePhotoTargetSize(width: number, height: number): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new PracticePhotoError("DECODE_FAILED", "Fotka nemá platné rozměry. Zkus ji vyfotit znovu.");
  }
  const ratio = Math.min(1, PRACTICE_PHOTO_MAX_DIMENSION / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeWithImageElement(file: File): Promise<DecodedImage> {
  const url = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("decode failed"));
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => {
        image.onload = null;
        image.onerror = null;
        image.src = "";
        URL.revokeObjectURL(url);
      },
    };
  } catch (error) {
    image.onload = null;
    image.onerror = null;
    URL.revokeObjectURL(url);
    throw error;
  }
}

async function decodePhoto(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Starší prohlížeče nebo HEIC mohou uspět přes HTMLImageElement.
    }
  }
  try { return await decodeWithImageElement(file); } catch (error) {
    if (!isHeic(file)) throw error;
    // Lazy decoder only when the browser cannot decode HEIC natively.
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: PRACTICE_PHOTO_JPEG_QUALITY });
    const jpeg = Array.isArray(converted) ? converted[0] : converted;
    if (!jpeg) throw new Error("HEIC decode failed");
    return decodeWithImageElement(new File([jpeg], "photo.jpg", { type: "image/jpeg" }));
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new PracticePhotoError("DECODE_FAILED", "Fotku se nepodařilo převést na JPEG. Zkus ji nahrát jako JPEG."));
    }, "image/jpeg", PRACTICE_PHOTO_JPEG_QUALITY);
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("base64 conversion failed"));
    reader.readAsDataURL(blob);
  });
}

/** Lokální konverze: původní soubor ani EXIF se nikam neodesílají. */
export async function preparePracticePhoto(file: File, maxInputBytes = PRACTICE_PHOTO_INPUT_MAX_BYTES): Promise<PreparedPracticePhoto> {
  validatePracticePhotoFile(file, maxInputBytes);
  let decoded: DecodedImage | null = null;
  let canvas: HTMLCanvasElement | null = null;
  try {
    decoded = await decodePhoto(file);
    const target = practicePhotoTargetSize(decoded.width, decoded.height);
    canvas = document.createElement("canvas");
    canvas.width = target.width;
    canvas.height = target.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new PracticePhotoError("DECODE_FAILED", "V tomto prohlížeči nejde fotku zmenšit. Zkus ji nahrát jako JPEG.");
    }
    context.drawImage(decoded.source, 0, 0, target.width, target.height);
    const jpeg = await canvasToJpeg(canvas);
    if (jpeg.size > PRACTICE_PHOTO_OUTPUT_MAX_BYTES) {
      throw new PracticePhotoError("OUTPUT_TOO_LARGE", "Fotka je i po zmenšení větší než 4 MB. Vyfot menší část stránky nebo ji nahraj jako JPEG.");
    }
    const imageBase64 = await blobToBase64(jpeg);
    return {
      imageBase64,
      mimeType: "image/jpeg",
      previewUrl: URL.createObjectURL(jpeg),
      width: target.width,
      height: target.height,
      sizeBytes: jpeg.size,
    };
  } catch (error) {
    if (error instanceof PracticePhotoError) throw error;
    if (isHeic(file)) throw new PracticePhotoError("HEIC_UNSUPPORTED", PRACTICE_PHOTO_HEIC_MESSAGE);
    throw new PracticePhotoError("DECODE_FAILED", "Fotku se nepodařilo otevřít. Vyfot ji znovu nebo ji nahraj jako JPEG.");
  } finally {
    decoded?.close();
    if (canvas) {
      canvas.width = 1;
      canvas.height = 1;
    }
  }
}

export function disposePracticePhoto(photo: PreparedPracticePhoto | null): void {
  if (!photo) return;
  URL.revokeObjectURL(photo.previewUrl);
  photo.imageBase64 = "";
}

/** Shared preparation for image-based generators that keep their original AI call. */
export async function prepareJpegPhoto(file: File, maxInputBytes = PRACTICE_PHOTO_INPUT_MAX_BYTES): Promise<{ file: File; dataUrl: string; preview: string }> {
  const photo = await preparePracticePhoto(file, maxInputBytes);
  try {
    const bytes = Uint8Array.from(atob(photo.imageBase64), (c) => c.charCodeAt(0));
    const jpeg = new File([bytes], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
    return { file: jpeg, dataUrl: `data:image/jpeg;base64,${photo.imageBase64}`, preview: URL.createObjectURL(jpeg) };
  } finally { disposePracticePhoto(photo); }
}

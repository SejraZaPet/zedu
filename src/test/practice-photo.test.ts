import { afterEach, describe, expect, it, vi } from "vitest";
import {
  disposePracticePhoto,
  practicePhotoTargetSize,
  PRACTICE_PHOTO_HEIC_MESSAGE,
  PRACTICE_PHOTO_OUTPUT_MAX_BYTES,
  preparePracticePhoto,
  validatePracticePhotoFile,
} from "@/lib/practice-photo";

const heic = vi.hoisted(() => ({ convert: vi.fn() }));
vi.mock("heic2any", () => ({ default: heic.convert }));

const file = (name: string, type: string, size = 1000) => {
  const value = new File(["fotka"], name, { type });
  Object.defineProperty(value, "size", { value: size });
  return value;
};

function mockCanvas(blobSize = 100) {
  const context = { drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: BlobCallback) => callback(new Blob([new Uint8Array(blobSize)], { type: "image/jpeg" }))),
  };
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return canvas as unknown as HTMLCanvasElement;
    return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
  });
  return { canvas, context };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("příprava fotografie pro Učím se", () => {
  it("HEIC bez nativní podpory převede místním dekodérem na JPEG", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("unsupported"); }));
    heic.convert.mockResolvedValue(new Blob(["[TEST] JPEG"], { type: "image/jpeg" }));
    URL.createObjectURL = vi.fn((blob: Blob) => blob.type === "image/jpeg" ? "blob:jpeg" : "blob:heic");
    URL.revokeObjectURL = vi.fn();
    class FakeImage {
      naturalWidth = 800; naturalHeight = 600;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(value: string) { if (value === "blob:jpeg") this.onload?.(); else if (value) this.onerror?.(); }
    }
    vi.stubGlobal("Image", FakeImage);
    mockCanvas();
    const photo = await preparePracticePhoto(file("[TEST].heic", "image/heic"));
    expect(heic.convert).toHaveBeenCalledWith(expect.objectContaining({ toType: "image/jpeg" }));
    expect(photo.mimeType).toBe("image/jpeg");
    disposePracticePhoto(photo);
  });
  it("odmítne neobrazový formát a vstup nad 15 MB", () => {
    expect(() => validatePracticePhotoFile(file("poznamky.txt", "text/plain"))).toThrow("JPEG, PNG, WebP nebo HEIC");
    expect(() => validatePracticePhotoFile(file("fotka.jpg", "image/jpeg", 15 * 1024 * 1024 + 1))).toThrow("15 MB");
  });

  it("dlouhou stranu zmenší na 2048 px a menší fotku nezvětší", () => {
    expect(practicePhotoTargetSize(4000, 1000)).toEqual({ width: 2048, height: 512 });
    expect(practicePhotoTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("převede fotku na JPEG, zavře bitmapu a uvolní canvas i náhled", async () => {
    const bitmap = { width: 4000, height: 1000, close: vi.fn() };
    const create = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", create);
    const { canvas, context } = mockCanvas();
    const revoke = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:nahled") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revoke });

    const photo = await preparePracticePhoto(file("fotka.jpg", "image/jpeg"));
    expect(photo.mimeType).toBe("image/jpeg");
    expect(photo).toMatchObject({ width: 2048, height: 512, sizeBytes: 100 });
    expect(context.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2048, 512);
    expect(create).toHaveBeenCalledWith(expect.any(File), { imageOrientation: "from-image" });
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(canvas).toMatchObject({ width: 1, height: 1 });
    expect(photo.imageBase64.length).toBeGreaterThan(0);

    disposePracticePhoto(photo);
    expect(revoke).toHaveBeenCalledWith("blob:nahled");
    expect(photo.imageBase64).toBe("");
  });

  it("HEIC bez podpory prohlížeče odmítne s návodem na JPEG", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => { throw new Error("unsupported"); }));
    class BrokenImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_value: string) { this.onerror?.(); }
    }
    vi.stubGlobal("Image", BrokenImage);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: vi.fn(() => "blob:heic") });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: vi.fn() });

    await expect(preparePracticePhoto(file("fotka.heic", "image/heic"))).rejects.toThrow(PRACTICE_PHOTO_HEIC_MESSAGE);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:heic");
  });

  it("výstup nad 4 MB odmítne", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({ width: 800, height: 600, close: vi.fn() })));
    mockCanvas(PRACTICE_PHOTO_OUTPUT_MAX_BYTES + 1);
    await expect(preparePracticePhoto(file("fotka.jpg", "image/jpeg"))).rejects.toThrow("4 MB");
  });
});

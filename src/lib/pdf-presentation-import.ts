import { PresentationImageImportCache, createPresentationImageUploader, IMPORT_TOTAL_MAX_BYTES, readBlobArrayBuffer, type PresentationImageUpload } from "@/lib/presentation-import-images";
import type { PresentationImportProgress, PresentationImportResult } from "@/lib/presentation-import-types";

export const PDF_IMPORT_MAX_BYTES = IMPORT_TOTAL_MAX_BYTES;
export const PDF_IMPORT_MAX_PAGES = 50;
export type PdfImportMode = "images" | "images-text";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function assertPdfImportLimits(size: number, pages: number) {
  if (size > PDF_IMPORT_MAX_BYTES) throw new Error("PDF je příliš velké. Maximální velikost je 60 MB.");
  if (pages > PDF_IMPORT_MAX_PAGES) throw new Error(`PDF má ${pages} stran. Najednou lze importovat nejvýše ${PDF_IMPORT_MAX_PAGES} stran.`);
  if (pages < 1) throw new Error("PDF neobsahuje žádné strany.");
}

export function pdfTextItemsToBlocks(items: any[], pageWidth: number, pageHeight: number) {
  const blocks: Record<string, any>[] = [];
  for (const item of items) {
    const text = String(item?.str || "").trim(); if (!text) continue;
    const t = Array.isArray(item.transform) ? item.transform : [1, 0, 0, 1, 0, 0];
    const pdfFont = Math.max(4, Math.hypot(Number(t[2]) || 0, Number(t[3]) || Number(t[0]) || 10));
    const fontSize = Math.max(6, pdfFont * 900 / pageHeight * 0.75);
    const h = Math.max(1.2, pdfFont * 1.35 / pageHeight * 100);
    const x = Number(t[4]) / pageWidth * 100;
    const y = (pageHeight - Number(t[5]) - pdfFont) / pageHeight * 100;
    const w = Math.max(2, (Number(item.width) || text.length * pdfFont * 0.55) / pageWidth * 100 + 1);
    blocks.push({ id: crypto.randomUUID(), type: "paragraph", visible: true, frame: { x, y, w, h }, zIndex: blocks.length + 1, props: { text: esc(text), fontSize, fontFamily: "Arial, sans-serif", color: "transparent", sourceTextColor: "#2B1A3F", align: "left", lineHeight: 1.05, pdfTextLayer: true } });
  }
  return blocks;
}

async function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Stránku PDF se nepodařilo vykreslit.")), "image/jpeg", 0.92));
}

export interface PdfPresentationImportOptions {
  mode: PdfImportMode;
  userId?: string;
  uploadImage?: PresentationImageUpload;
  onProgress?: (progress: PresentationImportProgress) => void;
}

export async function importPdfPresentation(file: File, options: PdfPresentationImportOptions): Promise<PresentationImportResult> {
  assertPdfImportLimits(file.size, 1);
  const { pdfjsLib } = await import("@/lib/pdf-page-renderer");
  const pdf = await pdfjsLib.getDocument({ data: await readBlobArrayBuffer(file) }).promise;
  assertPdfImportLimits(file.size, pdf.numPages);
  const cache = new PresentationImageImportCache(options.uploadImage || createPresentationImageUploader(options.userId));
  const slides: Record<string, any>[] = [];
  const warnings = new Set<string>(); let editableTextLayers = 0, textElements = 0;
  for (let number = 1; number <= pdf.numPages; number++) {
    options.onProgress?.({ current: number, total: pdf.numPages, message: `Vykresluji stranu ${number} z ${pdf.numPages}…` });
    const page = await pdf.getPage(number);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(3, 2560 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas"); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext("2d"); if (!context) throw new Error("Prohlížeč nepodporuje vykreslení PDF.");
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const blob = await canvasBlob(canvas);
    const url = await cache.import(new Uint8Array(await blob.arrayBuffer()));
    let blocks: Record<string, any>[] = [];
    if (options.mode === "images-text") {
      const content = await page.getTextContent();
      blocks = pdfTextItemsToBlocks(content.items, base.width, base.height);
      editableTextLayers += blocks.length; textElements += blocks.length;
      if (!blocks.length) warnings.add(`Strana ${number} nemá textovou vrstvu; zůstala jako věrný obrázek.`);
    }
    slides.push({ slideId: crypto.randomUUID(), type: "content", projector: { headline: "", body: "" }, device: { instructions: "" }, blocks, teacherNotes: "", backgroundOverride: { image: url }, importSource: "pdf", sourceAspectRatio: base.width / base.height });
    canvas.width = canvas.height = 1;
  }
  if (options.mode === "images-text" && !editableTextLayers) warnings.add("PDF je pravděpodobně naskenované. Všechny strany zůstaly jako obrázky.");
  return { slides, summary: { slideCount: slides.length, textElements, shapes: 0, images: slides.length, notes: 0, warnings: [...warnings], editableTextLayers } };
}

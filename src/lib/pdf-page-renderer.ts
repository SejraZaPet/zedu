import * as pdfjsLib from "pdfjs-dist";
// Bundle the worker locally so its version always matches the library
import PdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?worker";

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

export async function renderPdfPagesToImages(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const images: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;

    // JPEG keeps payload reasonable
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    images.push(imageBase64);
  }

  return images;
}

/**
 * Extract the text layer from a PDF using pdfjs. Reliable across compressed
 * streams and CID fonts, unlike the previous raw-Tj/TJ regex approach.
 * Returns "" if the PDF has no text layer (scanned/image-only PDFs) — the
 * caller should fall back to AI vision extraction in that case.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item ? (item as { str: string }).str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (pageText) pages.push(`--- Strana ${i} ---\n${pageText}`);
  }

  return pages.join("\n\n");
}

/**
 * Extract embedded raster images from a PDF using pdfjs operator lists.
 * NOT full-page renders — only actually embedded raster XObjects.
 *
 * Reliability notes:
 * - pdfjs image objects sometimes surface as ImageBitmap, sometimes as raw
 *   { width, height, data } with variable channel counts (1/3/4). We handle
 *   the common cases; unusual color spaces (CMYK, indexed) may be skipped.
 * - Duplicate references (same XObject painted multiple times) are deduped
 *   by name to avoid uploading the same asset over and over.
 * - Very large images (> maxPixelDim in either dimension) are skipped —
 *   they are almost always extraction glitches or backgrounds.
 */
export async function extractPdfEmbeddedImages(
  file: File,
  opts: { maxPixelDim?: number; maxImages?: number } = {},
): Promise<Blob[]> {
  const maxPixelDim = opts.maxPixelDim ?? 4000;
  const maxImages = opts.maxImages ?? 200;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const OPS = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS;

  const paintOps = new Set(
    [OPS.paintImageXObject, OPS.paintJpegXObject, OPS.paintImageXObjectRepeat].filter(
      (v) => typeof v === "number",
    ),
  );

  const seen = new Set<string>();
  const out: Blob[] = [];

  for (let i = 1; i <= pdf.numPages && out.length < maxImages; i++) {
    const page = await pdf.getPage(i);
    const ops = await page.getOperatorList();

    for (let k = 0; k < ops.fnArray.length && out.length < maxImages; k++) {
      if (!paintOps.has(ops.fnArray[k])) continue;
      const name = ops.argsArray[k]?.[0];
      if (typeof name !== "string" || seen.has(name)) continue;
      seen.add(name);

      let imgObj: any;
      try {
        imgObj = await new Promise((resolve, reject) => {
          try {
            // Common objs first, then page objs — some pdfjs versions store here
            const commonObjs = (page as any).commonObjs;
            if (commonObjs?.has?.(name)) {
              commonObjs.get(name, resolve);
              return;
            }
            page.objs.get(name, resolve);
          } catch (e) {
            reject(e);
          }
        });
      } catch {
        continue;
      }
      if (!imgObj) continue;

      const width = imgObj.width ?? imgObj.bitmap?.width;
      const height = imgObj.height ?? imgObj.bitmap?.height;
      if (!width || !height) continue;
      if (width > maxPixelDim || height > maxPixelDim) continue;
      if (width < 16 || height < 16) continue; // decorative crumbs

      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) continue;

        if (imgObj.bitmap) {
          ctx.drawImage(imgObj.bitmap, 0, 0);
        } else if (imgObj.data) {
          const src: Uint8Array | Uint8ClampedArray = imgObj.data;
          const px = width * height;
          const channels = Math.round(src.length / px);
          const imageData = ctx.createImageData(width, height);
          const dst = imageData.data;
          if (channels === 4) {
            dst.set(src);
          } else if (channels === 3) {
            for (let j = 0, d = 0; j < src.length; j += 3, d += 4) {
              dst[d] = src[j];
              dst[d + 1] = src[j + 1];
              dst[d + 2] = src[j + 2];
              dst[d + 3] = 255;
            }
          } else if (channels === 1) {
            for (let j = 0, d = 0; j < src.length; j++, d += 4) {
              dst[d] = dst[d + 1] = dst[d + 2] = src[j];
              dst[d + 3] = 255;
            }
          } else {
            continue; // unsupported color layout
          }
          ctx.putImageData(imageData, 0, 0);
        } else {
          continue;
        }

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85),
        );
        if (blob && blob.size > 0) out.push(blob);
      } catch (err) {
        console.warn("PDF image extraction skipped one image:", err);
      }
    }
  }

  return out;
}

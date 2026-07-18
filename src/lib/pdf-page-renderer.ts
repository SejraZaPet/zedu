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
  opts: { maxPixelDim?: number; maxImages?: number; objsTimeoutMs?: number } = {},
): Promise<Blob[]> {
  const maxPixelDim = opts.maxPixelDim ?? 4000;
  const maxImages = opts.maxImages ?? 200;
  const objsTimeoutMs = opts.objsTimeoutMs ?? 5000;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const OPS = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS;

  // XObject paint ops — image XObject data lives in page.objs / commonObjs
  // and requires the page to have been rendered before it is populated on
  // the main thread (pdfjs v4+ behavior). Names come from argsArray[k][0].
  const xobjectOps = new Set(
    [OPS.paintImageXObject, OPS.paintImageXObjectRepeat].filter(
      (v) => typeof v === "number",
    ),
  );

  // Inline image op — image dict is embedded directly in argsArray[k][0]
  // with { width, height, data|bitmap } already present. No objs lookup.
  const inlineOp = typeof OPS.paintInlineImageXObject === "number"
    ? OPS.paintInlineImageXObject
    : -1;

  const seen = new Set<string>();
  const out: Blob[] = [];

  // Reusable throwaway canvas — rendering the page is the only reliable way
  // to force pdfjs to transfer image XObjects onto the main thread so
  // page.objs.get() resolves. We don't care about the pixels; we discard.
  const renderCanvas = document.createElement("canvas");
  const renderCtx = renderCanvas.getContext("2d");

  const getObj = (page: any, name: string): Promise<any> =>
    new Promise((resolve) => {
      let done = false;
      const finish = (val: any) => {
        if (done) return;
        done = true;
        resolve(val);
      };
      const timer = setTimeout(() => finish(null), objsTimeoutMs);
      const wrap = (val: any) => {
        clearTimeout(timer);
        finish(val);
      };
      try {
        const commonObjs = page.commonObjs;
        if (commonObjs?.has?.(name)) {
          commonObjs.get(name, wrap);
          return;
        }
        if (page.objs?.has?.(name)) {
          page.objs.get(name, wrap);
          return;
        }
        // Not resolved yet — register the callback and rely on the timeout
        page.objs.get(name, wrap);
      } catch {
        wrap(null);
      }
    });

  for (let i = 1; i <= pdf.numPages && out.length < maxImages; i++) {
    const page = await pdf.getPage(i);

    // Render page to a throwaway canvas at low scale — this pushes all image
    // XObjects onto the main thread. Low scale keeps CPU/memory reasonable;
    // image data itself is transferred regardless of scale.
    try {
      if (renderCtx) {
        const viewport = page.getViewport({ scale: 0.5 });
        renderCanvas.width = Math.max(1, Math.floor(viewport.width));
        renderCanvas.height = Math.max(1, Math.floor(viewport.height));
        await page.render({ canvas: renderCanvas, canvasContext: renderCtx, viewport }).promise;
      }
    } catch (err) {
      // If render fails we still try operator-list extraction — inline images
      // and any already-resolved XObjects can still work.
      console.warn(`PDF embedded image render prep failed on page ${i}:`, err);
    }

    const ops = await page.getOperatorList();

    for (let k = 0; k < ops.fnArray.length && out.length < maxImages; k++) {
      const op = ops.fnArray[k];
      let imgObj: any = null;

      if (xobjectOps.has(op)) {
        const name = ops.argsArray[k]?.[0];
        if (typeof name !== "string" || seen.has(name)) continue;
        seen.add(name);
        imgObj = await getObj(page, name);
      } else if (op === inlineOp) {
        // Inline images: image dict is the first arg. Dedup by data reference.
        const dict = ops.argsArray[k]?.[0];
        if (!dict) continue;
        imgObj = dict;
      } else {
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

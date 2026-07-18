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
  opts: { maxPixelDim?: number; maxImages?: number; objsTimeoutMs?: number; debug?: boolean } = {},
): Promise<Blob[]> {
  const maxPixelDim = opts.maxPixelDim ?? 4000;
  const maxImages = opts.maxImages ?? 200;
  const objsTimeoutMs = opts.objsTimeoutMs ?? 5000;
  const debug = opts.debug ?? false;
  const dlog = (...args: unknown[]) => { if (debug) console.log("[pdf-img-extract]", ...args); };
  const skipReasons: Record<string, number> = {};
  const bump = (k: string) => { skipReasons[k] = (skipReasons[k] ?? 0) + 1; };

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const OPS = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS;

  dlog("pdfjs version", (pdfjsLib as any).version, "numPages", pdf.numPages);
  dlog("OPS", {
    paintImageXObject: OPS.paintImageXObject,
    paintImageXObjectRepeat: OPS.paintImageXObjectRepeat,
    paintInlineImageXObject: OPS.paintInlineImageXObject,
    paintJpegXObject: OPS.paintJpegXObject,
    paintImageMaskXObject: OPS.paintImageMaskXObject,
  });

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
      const timer = setTimeout(() => { dlog("getObj TIMEOUT", name); finish(null); }, objsTimeoutMs);
      const wrap = (val: any) => {
        clearTimeout(timer);
        finish(val);
      };
      try {
        const commonObjs = page.commonObjs;
        if (commonObjs?.has?.(name)) {
          dlog("getObj commonObjs.has", name);
          commonObjs.get(name, wrap);
          return;
        }
        if (page.objs?.has?.(name)) {
          dlog("getObj objs.has", name);
          page.objs.get(name, wrap);
          return;
        }
        dlog("getObj neither has, registering callback", name);
        page.objs.get(name, wrap);
      } catch (e) {
        dlog("getObj threw", name, e);
        wrap(null);
      }
    });

  for (let i = 1; i <= pdf.numPages && out.length < maxImages; i++) {
    const page = await pdf.getPage(i);

    try {
      if (renderCtx) {
        const viewport = page.getViewport({ scale: 0.5 });
        renderCanvas.width = Math.max(1, Math.floor(viewport.width));
        renderCanvas.height = Math.max(1, Math.floor(viewport.height));
        await page.render({ canvas: renderCanvas, canvasContext: renderCtx, viewport } as any).promise;
        dlog("page", i, "rendered", { w: renderCanvas.width, h: renderCanvas.height });
      }
    } catch (err) {
      dlog("page", i, "render FAILED", err);
      bump("render-error");
    }

    const ops = await page.getOperatorList();
    let xoCount = 0, inlineCount = 0, otherImgCount = 0;
    for (const fn of ops.fnArray) {
      if (xobjectOps.has(fn)) xoCount++;
      else if (fn === inlineOp) inlineCount++;
      else if (fn === OPS.paintJpegXObject || fn === OPS.paintImageMaskXObject) otherImgCount++;
    }
    dlog("page", i, "ops", ops.fnArray.length, "xobject", xoCount, "inline", inlineCount, "other-image", otherImgCount);

    for (let k = 0; k < ops.fnArray.length && out.length < maxImages; k++) {
      const op = ops.fnArray[k];
      let imgObj: any = null;
      let source = "";

      if (xobjectOps.has(op)) {
        source = "xobject";
        const name = ops.argsArray[k]?.[0];
        if (typeof name !== "string") { bump("no-name"); continue; }
        if (seen.has(name)) { bump("dedup"); continue; }
        seen.add(name);
        imgObj = await getObj(page, name);
        dlog("xobj", name, imgObj ? { keys: Object.keys(imgObj), w: imgObj.width, h: imgObj.height, hasBitmap: !!imgObj.bitmap, hasData: !!imgObj.data, dataLen: imgObj.data?.length, kind: imgObj.kind } : "NULL");
      } else if (op === inlineOp) {
        source = "inline";
        const dict = ops.argsArray[k]?.[0];
        if (!dict) { bump("inline-no-dict"); continue; }
        imgObj = dict;
        dlog("inline", { keys: Object.keys(imgObj), w: imgObj.width, h: imgObj.height, hasBitmap: !!imgObj.bitmap, hasData: !!imgObj.data });
      } else {
        continue;
      }

      if (!imgObj) { bump("getObj-null"); continue; }

      const width = imgObj.width ?? imgObj.bitmap?.width;
      const height = imgObj.height ?? imgObj.bitmap?.height;
      if (!width || !height) { bump("no-dims"); dlog("skip no-dims", source); continue; }
      if (width > maxPixelDim || height > maxPixelDim) { bump("too-large"); continue; }
      if (width < 16 || height < 16) { bump("too-small"); continue; }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { bump("no-ctx"); continue; }

        if (imgObj.bitmap) {
          ctx.drawImage(imgObj.bitmap, 0, 0);
        } else if (imgObj.data) {
          const src: Uint8Array | Uint8ClampedArray = imgObj.data;
          const px = width * height;
          const channels = Math.round(src.length / px);
          dlog("decode", { width, height, dataLen: src.length, channels });
          const imageData = ctx.createImageData(width, height);
          const dst = imageData.data;
          if (channels === 4) {
            dst.set(src);
          } else if (channels === 3) {
            for (let j = 0, d = 0; j < src.length; j += 3, d += 4) {
              dst[d] = src[j]; dst[d + 1] = src[j + 1]; dst[d + 2] = src[j + 2]; dst[d + 3] = 255;
            }
          } else if (channels === 1) {
            for (let j = 0, d = 0; j < src.length; j++, d += 4) {
              dst[d] = dst[d + 1] = dst[d + 2] = src[j]; dst[d + 3] = 255;
            }
          } else {
            bump("unsupported-channels"); continue;
          }
          ctx.putImageData(imageData, 0, 0);
        } else {
          bump("no-drawable"); dlog("skip no-drawable", Object.keys(imgObj)); continue;
        }

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85),
        );
        if (blob && blob.size > 0) { out.push(blob); dlog("emitted", source, blob.size); }
        else bump("empty-blob");
      } catch (err) {
        bump("decode-error");
        dlog("decode threw", err);
      }
    }
  }

  dlog("SUMMARY", { imagesReturned: out.length, skipReasons });
  return out;
}

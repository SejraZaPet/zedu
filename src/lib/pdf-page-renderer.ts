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
  const summarizeError = (err: unknown) => {
    if (err instanceof Error) return { name: err.name, message: err.message, stack: err.stack };
    return err;
  };
  const skipReasons: Record<string, number> = {};
  const bump = (k: string, detail?: unknown) => {
    skipReasons[k] = (skipReasons[k] ?? 0) + 1;
    if (debug) dlog("skip", k, detail ?? "");
  };

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const OPS = (pdfjsLib as unknown as { OPS: Record<string, number> }).OPS;

  dlog("START", { fileName: file.name, fileType: file.type, fileSize: file.size, arrayBufferBytes: arrayBuffer.byteLength });
  dlog("runtime", {
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "n/a",
    devicePixelRatio: typeof window !== "undefined" ? window.devicePixelRatio : "n/a",
    hasDocument: typeof document !== "undefined",
    mapGetOrInsertComputed: typeof (Map.prototype as any).getOrInsertComputed,
    mapGetOrInsert: typeof (Map.prototype as any).getOrInsert,
  });
  dlog("pdfjs version", (pdfjsLib as any).version, "numPages", pdf.numPages);
  dlog("OPS", {
    paintImageXObject: OPS.paintImageXObject,
    paintImageXObjectRepeat: OPS.paintImageXObjectRepeat,
    paintInlineImageXObject: OPS.paintInlineImageXObject,
    paintJpegXObject: OPS.paintJpegXObject,
    paintImageMaskXObject: OPS.paintImageMaskXObject,
    paintImageMaskXObjectGroup: OPS.paintImageMaskXObjectGroup,
    paintSolidColorImageMask: OPS.paintSolidColorImageMask,
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
      const timer = setTimeout(() => { dlog("getObj TIMEOUT", { name, objsTimeoutMs }); finish(null); }, objsTimeoutMs);
      const wrap = (val: any) => {
        clearTimeout(timer);
        finish(val);
      };
      try {
        const commonObjs = page.commonObjs;
        dlog("getObj lookup", {
          name,
          commonHas: commonObjs?.has?.(name),
          objsHas: page.objs?.has?.(name),
          commonKeys: commonObjs ? Object.keys(commonObjs) : [],
          objsKeys: page.objs ? Object.keys(page.objs) : [],
        });
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
        dlog("getObj threw", name, summarizeError(e));
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
        dlog("page", i, "render attempt", {
          renderContextShape: "canvas+canvasContext+viewport",
          viewport: { width: viewport.width, height: viewport.height, scale: viewport.scale },
          canvas: { width: renderCanvas.width, height: renderCanvas.height },
        });
        await page.render({ canvas: renderCanvas, canvasContext: renderCtx, viewport } as any).promise;
        dlog("page", i, "render OK", { renderContextShape: "canvas+canvasContext+viewport", w: renderCanvas.width, h: renderCanvas.height });
      }
    } catch (err) {
      dlog("page", i, "render FAILED", { renderContextShape: "canvas+canvasContext+viewport", error: summarizeError(err) });
      bump("render-error", { page: i, shape: "canvas+canvasContext+viewport" });

      if (debug && renderCtx) {
        try {
          const viewport = page.getViewport({ scale: 0.5 });
          dlog("page", i, "render fallback attempt", { renderContextShape: "canvasContext+viewport" });
          await page.render({ canvasContext: renderCtx, viewport } as any).promise;
          dlog("page", i, "render fallback OK", { renderContextShape: "canvasContext+viewport" });
        } catch (fallbackErr) {
          dlog("page", i, "render fallback FAILED", { renderContextShape: "canvasContext+viewport", error: summarizeError(fallbackErr) });
          bump("render-fallback-error", { page: i, shape: "canvasContext+viewport" });
        }
      }
    }

    let ops: Awaited<ReturnType<typeof page.getOperatorList>>;
    try {
      dlog("page", i, "getOperatorList attempt");
      ops = await page.getOperatorList();
      dlog("page", i, "getOperatorList OK", { fnArrayLength: ops.fnArray.length, argsArrayLength: ops.argsArray.length });
    } catch (err) {
      dlog("page", i, "getOperatorList FAILED", summarizeError(err));
      throw err;
    }
    let xoCount = 0, inlineCount = 0, otherImgCount = 0;
    const opHistogram: Record<string, number> = {};
    for (const fn of ops.fnArray) {
      if (debug) opHistogram[String(fn)] = (opHistogram[String(fn)] ?? 0) + 1;
      if (xobjectOps.has(fn)) xoCount++;
      else if (fn === inlineOp) inlineCount++;
      else if (fn === OPS.paintJpegXObject || fn === OPS.paintImageMaskXObject) otherImgCount++;
    }
    dlog("page", i, "ops", ops.fnArray.length, "xobject", xoCount, "inline", inlineCount, "other-image", otherImgCount, "histogram", opHistogram);

    for (let k = 0; k < ops.fnArray.length && out.length < maxImages; k++) {
      const op = ops.fnArray[k];
      let imgObj: any = null;
      let source = "";

      if (xobjectOps.has(op)) {
        source = "xobject";
        const name = ops.argsArray[k]?.[0];
        dlog("candidate", { page: i, index: k, op, source, name, rawArgs: ops.argsArray[k] });
        if (typeof name !== "string") { bump("no-name", { page: i, index: k, op, rawArgs: ops.argsArray[k] }); continue; }
        if (seen.has(name)) { bump("dedup", { page: i, index: k, name }); continue; }
        seen.add(name);
        imgObj = await getObj(page, name);
        dlog("xobj", name, imgObj ? {
          nonNull: true,
          type: Object.prototype.toString.call(imgObj),
          keys: Object.keys(imgObj),
          w: imgObj.width,
          h: imgObj.height,
          bitmapW: imgObj.bitmap?.width,
          bitmapH: imgObj.bitmap?.height,
          hasBitmap: !!imgObj.bitmap,
          hasData: !!imgObj.data,
          dataCtor: imgObj.data?.constructor?.name,
          dataLen: imgObj.data?.length,
          kind: imgObj.kind,
        } : { nonNull: false });
      } else if (op === inlineOp) {
        source = "inline";
        const dict = ops.argsArray[k]?.[0];
        dlog("candidate", { page: i, index: k, op, source, rawArgs: ops.argsArray[k] });
        if (!dict) { bump("inline-no-dict", { page: i, index: k, op }); continue; }
        imgObj = dict;
        dlog("inline", { type: Object.prototype.toString.call(imgObj), keys: Object.keys(imgObj), w: imgObj.width, h: imgObj.height, hasBitmap: !!imgObj.bitmap, hasData: !!imgObj.data, dataCtor: imgObj.data?.constructor?.name, dataLen: imgObj.data?.length });
      } else {
        continue;
      }

      if (!imgObj) { bump("getObj-null", { page: i, index: k, source }); continue; }

      const width = imgObj.width ?? imgObj.bitmap?.width;
      const height = imgObj.height ?? imgObj.bitmap?.height;
      dlog("dimension check", { page: i, index: k, source, width, height, maxPixelDim });
      if (!width || !height) { bump("no-dims", { page: i, index: k, source, width, height }); continue; }
      if (width > maxPixelDim || height > maxPixelDim) { bump("too-large", { page: i, index: k, source, width, height, maxPixelDim }); continue; }
      if (width < 16 || height < 16) { bump("too-small", { page: i, index: k, source, width, height }); continue; }

      try {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) { bump("no-ctx", { page: i, index: k, source }); continue; }

        if (imgObj.bitmap) {
          dlog("draw bitmap", { page: i, index: k, source, width, height });
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
            bump("unsupported-channels", { page: i, index: k, source, width, height, dataLen: src.length, channels }); continue;
          }
          ctx.putImageData(imageData, 0, 0);
        } else {
          bump("no-drawable", { page: i, index: k, source, keys: Object.keys(imgObj) }); continue;
        }

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/jpeg", 0.85),
        );
        if (blob && blob.size > 0) { out.push(blob); dlog("emitted", source, blob.size); }
        else bump("empty-blob", { page: i, index: k, source });
      } catch (err) {
        bump("decode-error", { page: i, index: k, source });
        dlog("decode threw", summarizeError(err));
      }
    }
  }

  dlog("SUMMARY", { imagesReturned: out.length, skipReasons });
  return out;
}

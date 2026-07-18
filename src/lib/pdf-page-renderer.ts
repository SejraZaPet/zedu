// Defensive polyfill for a TC39 Stage-3 Map method that pdfjs-dist v5 relies on
// but which Vite's dep optimizer (esbuild) can strip / which older browser
// engines lack. Must run BEFORE pdfjs-dist is imported.
if (typeof Map !== "undefined" && !(Map.prototype as any).getOrInsertComputed) {
  Object.defineProperty(Map.prototype, "getOrInsertComputed", {
    configurable: true,
    writable: true,
    value: function <K, V>(this: Map<K, V>, key: K, compute: (k: K) => V): V {
      if (this.has(key)) return this.get(key) as V;
      const value = compute(key);
      this.set(key, value);
      return value;
    },
  });
}
if (typeof Map !== "undefined" && !(Map.prototype as any).getOrInsert) {
  Object.defineProperty(Map.prototype, "getOrInsert", {
    configurable: true,
    writable: true,
    value: function <K, V>(this: Map<K, V>, key: K, defaultValue: V): V {
      if (this.has(key)) return this.get(key) as V;
      this.set(key, defaultValue);
      return defaultValue;
    },
  });
}

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
 *
 * Uses positional data (x/y from item.transform) to:
 *   - Cluster items into rows by similar y-coordinate.
 *   - Detect ≥3 consecutive rows sharing a column layout and emit them as
 *     markdown tables so the downstream AI is much more likely to encode
 *     them as `table` blocks instead of a flat paragraph.
 *
 * Returns both a joined string and per-page data (charCount) so callers can
 * decide whether a given page needs a full-page render fallback (scanned
 * pages have near-zero extractable text).
 */
export interface PdfTextPage {
  pageNumber: number;
  text: string;
  charCount: number;
}

export interface PdfTextResult {
  text: string;
  pages: PdfTextPage[];
}

interface TextRow {
  y: number;
  items: { x: number; str: string; width: number }[];
}

const ROW_Y_TOLERANCE = 3;
const COL_X_TOLERANCE = 12;
const MIN_TABLE_ROWS = 3;
const MIN_TABLE_COLS = 2;
const MAX_TABLE_COLS = 8;

function clusterRows(items: { transform: number[]; str: string; width?: number }[]): TextRow[] {
  const withPos = items
    .filter((it) => typeof it.str === "string" && it.str.length > 0)
    .map((it) => ({
      x: Number(it.transform?.[4] ?? 0),
      y: Number(it.transform?.[5] ?? 0),
      str: it.str,
      width: Number(it.width ?? 0),
    }));
  withPos.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: TextRow[] = [];
  for (const it of withPos) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= ROW_Y_TOLERANCE) {
      last.items.push({ x: it.x, str: it.str, width: it.width });
    } else {
      rows.push({ y: it.y, items: [{ x: it.x, str: it.str, width: it.width }] });
    }
  }
  for (const row of rows) row.items.sort((a, b) => a.x - b.x);
  return rows;
}

function rowToCells(row: TextRow, gapThreshold: number): { x: number; text: string }[] {
  const cells: { x: number; text: string }[] = [];
  let lastEnd = -Infinity;
  for (const it of row.items) {
    if (cells.length > 0 && it.x - lastEnd < gapThreshold) {
      const last = cells[cells.length - 1];
      last.text = `${last.text} ${it.str}`.replace(/\s+/g, " ").trim();
    } else {
      cells.push({ x: it.x, text: it.str });
    }
    lastEnd = it.x + (it.width || it.str.length * 5);
  }
  return cells;
}

function detectTableRanges(rows: TextRow[]): { start: number; end: number; gapThreshold: number }[] {
  const ranges: { start: number; end: number; gapThreshold: number }[] = [];
  let i = 0;
  while (i < rows.length) {
    let bestEnd = -1;
    let bestGap = 0;
    for (const gap of [25, 40, 60]) {
      const firstCells = rowToCells(rows[i], gap);
      const cols = firstCells.length;
      if (cols < MIN_TABLE_COLS || cols > MAX_TABLE_COLS) continue;
      let end = i;
      for (let j = i + 1; j < rows.length; j++) {
        const cells = rowToCells(rows[j], gap);
        if (cells.length !== cols) break;
        let aligned = true;
        for (let c = 0; c < cols; c++) {
          if (Math.abs(cells[c].x - firstCells[c].x) > COL_X_TOLERANCE) { aligned = false; break; }
        }
        if (!aligned) break;
        end = j;
      }
      if (end - i + 1 >= MIN_TABLE_ROWS && end > bestEnd) {
        bestEnd = end;
        bestGap = gap;
      }
    }
    if (bestEnd >= 0) {
      ranges.push({ start: i, end: bestEnd, gapThreshold: bestGap });
      i = bestEnd + 1;
    } else {
      i++;
    }
  }
  return ranges;
}

function rowsToMarkdown(rows: TextRow[]): string {
  if (rows.length === 0) return "";
  const ranges = detectTableRanges(rows);
  const out: string[] = [];
  let cursor = 0;
  const flushPlain = (untilExclusive: number) => {
    const chunk: string[] = [];
    for (let r = cursor; r < untilExclusive; r++) {
      const line = rows[r].items.map((it) => it.str).join(" ").replace(/\s+/g, " ").trim();
      if (line) chunk.push(line);
    }
    if (chunk.length) out.push(chunk.join(" "));
  };
  for (const range of ranges) {
    flushPlain(range.start);
    const header = rowToCells(rows[range.start], range.gapThreshold).map((c) => c.text.trim());
    out.push(`| ${header.join(" | ")} |`);
    out.push(`| ${header.map(() => "---").join(" | ")} |`);
    for (let r = range.start + 1; r <= range.end; r++) {
      const cells = rowToCells(rows[r], range.gapThreshold).map((c) => c.text.trim());
      out.push(`| ${cells.join(" | ")} |`);
    }
    cursor = range.end + 1;
  }
  flushPlain(rows.length);
  return out.join("\n").trim();
}

export async function extractPdfText(file: File): Promise<PdfTextResult> {
  try {
    console.log("[pdf-text-diag] START", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      pdfjsVersion: (pdfjsLib as any).version,
      workerPort: !!pdfjsLib.GlobalWorkerOptions.workerPort,
      workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
    });

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    console.log("[pdf-text-diag] PDF loaded", { numPages: pdf.numPages });

    const pages: PdfTextPage[] = [];
    const joined: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const items = content.items as unknown as { transform: number[]; str: string; width?: number; hasEOL?: boolean }[];

      console.log("[pdf-text-diag] page", i, {
        itemsLength: items.length,
        firstFive: items.slice(0, 5).map((it) => ({
          str: it?.str,
          hasEOL: (it as any)?.hasEOL,
          transform: it?.transform,
          width: it?.width,
        })),
      });

      let raw = "";
      for (const it of items) {
        if (typeof it?.str !== "string") continue;
        raw += it.str;
        if (it.hasEOL) raw += "\n";
      }
      raw = raw.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

      let rendered = "";
      try {
        const rows = clusterRows(items);
        rendered = rowsToMarkdown(rows);
      } catch (err) {
        console.warn("[pdf-text] table clustering failed, using raw text", err);
        rendered = "";
      }

      if (!rendered && raw) rendered = raw;

      console.log("[pdf-text-diag] page", i, "extracted", {
        rawLen: raw.length,
        renderedLen: rendered.length,
      });


    pages.push({ pageNumber: i, text: rendered, charCount: rendered.length });
    if (rendered) joined.push(`--- Strana ${i} ---\n${rendered}`);
  }
  return { text: joined.join("\n\n"), pages };
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
  opts: { maxPixelDim?: number; maxImages?: number; objsTimeoutMs?: number; pageCoverageThreshold?: number; debug?: boolean } = {},
): Promise<{ pageNumber: number; blob: Blob }[]> {
  const maxPixelDim = opts.maxPixelDim ?? 4000;
  const maxImages = opts.maxImages ?? 200;
  const objsTimeoutMs = opts.objsTimeoutMs ?? 5000;
  const pageCoverageThreshold = opts.pageCoverageThreshold ?? 0.85;
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
  const out: { pageNumber: number; blob: Blob }[] = [];

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

    const pageViewport = page.getViewport({ scale: 1 });
    const transformOp = typeof OPS.transform === "number" ? OPS.transform : -1;
    let lastTransformA = 0;
    let lastTransformD = 0;

    for (let k = 0; k < ops.fnArray.length && out.length < maxImages; k++) {
      const op = ops.fnArray[k];
      if (op === transformOp) {
        const args = ops.argsArray[k];
        if (args && typeof args[0] === "number" && typeof args[3] === "number") {
          lastTransformA = Math.abs(args[0]);
          lastTransformD = Math.abs(args[3]);
        }
        continue;
      }
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

      // Full-page background filter: if painted size (from last transform op)
      // covers ≥ threshold of both viewport dimensions, treat as background.
      if (lastTransformA > 0 && lastTransformD > 0 && pageViewport.width > 0 && pageViewport.height > 0) {
        const coverW = lastTransformA / pageViewport.width;
        const coverH = lastTransformD / pageViewport.height;
        dlog("coverage check", { page: i, index: k, source, paintedW: lastTransformA, paintedH: lastTransformD, viewportW: pageViewport.width, viewportH: pageViewport.height, coverW, coverH, threshold: pageCoverageThreshold });
        if (coverW >= pageCoverageThreshold && coverH >= pageCoverageThreshold) {
          bump("full-page-background", { page: i, index: k, source, paintedW: lastTransformA, paintedH: lastTransformD, viewportW: pageViewport.width, viewportH: pageViewport.height, coverW, coverH });
          continue;
        }
      }

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
        if (blob && blob.size > 0) { out.push({ pageNumber: i, blob }); dlog("emitted", source, blob.size, "page", i); }
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

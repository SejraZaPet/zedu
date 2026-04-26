/**
 * Export pracovního listu do PDF s QR kódem v hlavičce.
 *
 * Postup:
 *  1) renderToHtml přes worksheet-print-renderer
 *  2) vygeneruj QR jako data URL (qrcode lib)
 *  3) inject <img> do .ws-header (pravý horní roh)
 *  4) html2pdf.js → download
 */

import QRCode from "qrcode";
import { renderWorksheetVariantHtml } from "./worksheet-print-renderer";
import type { WorksheetSpec } from "./worksheet-spec";

export interface PdfExportOptions {
  worksheetId: string;
  variantId?: string;
  includeAnswerKey?: boolean;
  includeNameField?: boolean;
  /** Base URL for student link (default: window.location.origin). */
  baseUrl?: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "pracovni-list";
}

/**
 * Vygeneruje finální HTML pro PDF (s QR kódem v rohu hlavičky).
 */
export async function buildWorksheetPdfHtml(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<{ html: string; filename: string }> {
  console.log("[PDF] buildWorksheetPdfHtml called with:", {
    title: spec.header?.title,
    variantsCount: spec.variants?.length,
    itemsCount: spec.variants?.[0]?.items?.length,
    variantId: options.variantId,
  });
  const variantId = options.variantId ?? spec.variants[0]?.variantId ?? "A";
  const baseUrl =
    options.baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://zedu.cz");
  const studentUrl = `${baseUrl}/student/pracovni-list/${options.worksheetId}`;

  // Apply renderConfig overrides (answer key)
  const specWithConfig: WorksheetSpec = {
    ...spec,
    renderConfig: {
      ...spec.renderConfig,
      includeAnswerKey: !!options.includeAnswerKey,
    },
  };

  const baseHtml = renderWorksheetVariantHtml(specWithConfig, variantId, {
    includeNameField: options.includeNameField,
  });
  console.log("[PDF] baseHtml length:", baseHtml.length);
  if (baseHtml.length < 500) {
    console.error("[PDF] CRITICAL: baseHtml is too short, render may be broken");
    console.log("[PDF] baseHtml:", baseHtml);
  }

  // QR jako data URL
  const qrDataUrl = await QRCode.toDataURL(studentUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
  console.log("[PDF] QR generated, dataUrl length:", qrDataUrl.length);

  const qrBlock = `
<div class="ws-qr-wrap" style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
  <img src="${qrDataUrl}" alt="QR online verze" style="width:74px;height:74px;display:block;border:1px solid #e2e8f0;border-radius:6px;padding:2px;background:#fff;" />
  <div style="font-size:9px;color:#475569;line-height:1.2;max-width:90px;">Pokračuj online →<br/>${studentUrl.replace(/^https?:\/\//, "")}</div>
</div>`;

  let html = baseHtml;
  const beforeLength = html.length;
  html = html.replace(
    /<div class="ws-header-top">([\s\S]*?)<\/div>\s*<div class="ws-meta-row">/,
    (_m, inner) =>
      `<div class="ws-header-top" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">${inner}${qrBlock}</div>\n  <div class="ws-meta-row">`,
  );
  if (beforeLength === html.length) {
    console.warn("[PDF] WARNING: ws-header-top regex did NOT match. PDF will lack QR but still render.");
  }

  const filename = `pracovni-list-${slugify(spec.header.title)}.pdf`;
  return { html, filename };
}

function buildPdfContainer(html: string): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.minHeight = "297mm";
  container.style.height = "auto";
  container.style.display = "block";
  container.style.background = "white";
  document.body.appendChild(container);

  // Ensure first child also has explicit auto height (avoid 0-height clones)
  const inner = container.firstElementChild as HTMLElement | null;
  if (inner) {
    inner.style.minHeight = "297mm";
    inner.style.height = "auto";
    inner.style.display = "block";
    inner.style.width = "100%";
    inner.style.maxWidth = "none";
  }
  // Also handle deeper children that may carry max-width from <body> styles
  Array.from(container.querySelectorAll<HTMLElement>(":scope > *")).forEach((el) => {
    el.style.maxWidth = "none";
  });
  return container;
}

const PDF_OPTIONS_BASE = {
  margin: [10, 10, 12, 10],
  image: { type: "jpeg", quality: 0.95 },
  html2canvas: { scale: 2, useCORS: true, letterRendering: true, windowWidth: 794 },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
  pagebreak: { mode: ["css", "legacy"] },
};

/**
 * Vygeneruje a stáhne PDF.
 */
export async function downloadWorksheetPdf(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<void> {
  console.log("[PDF] downloadWorksheetPdf started");
  const { html, filename } = await buildWorksheetPdfHtml(spec, options);

  console.log("[PDF-DIAG] Generated HTML (first 2000 chars):");
  console.log(html.substring(0, 2000));
  console.log("[PDF-DIAG] Generated HTML (last 1000 chars):");
  console.log(html.substring(html.length - 1000));

  const html2pdfMod: any = await import("html2pdf.js");
  const html2pdf = html2pdfMod.default ?? html2pdfMod;

  const container = buildPdfContainer(html);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  console.log("[PDF-DIAG] Container info:", {
    offsetWidth: container.offsetWidth,
    offsetHeight: container.offsetHeight,
    scrollHeight: container.scrollHeight,
    childCount: container.childElementCount,
    firstChildTag: container.firstElementChild?.tagName,
    innerHTMLLength: container.innerHTML.length,
  });

  const items = container.querySelectorAll(".ws-item");
  console.log("[PDF-DIAG] Found .ws-item elements:", items.length);

  if (items.length > 0) {
    const firstItem = items[0] as HTMLElement;
    const cs = getComputedStyle(firstItem);
    console.log("[PDF-DIAG] First .ws-item details:", {
      tag: firstItem.tagName,
      offsetHeight: firstItem.offsetHeight,
      offsetWidth: firstItem.offsetWidth,
      scrollHeight: firstItem.scrollHeight,
      textContent: firstItem.textContent?.substring(0, 200),
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      visibility: cs.visibility,
      opacity: cs.opacity,
      display: cs.display,
      fontSize: cs.fontSize,
      position: cs.position,
    });
  }

  const prompts = container.querySelectorAll(".prompt");
  console.log("[PDF-DIAG] Found .prompt elements:", prompts.length);

  if (prompts.length > 0) {
    const firstPrompt = prompts[0] as HTMLElement;
    const cs = getComputedStyle(firstPrompt);
    console.log("[PDF-DIAG] First .prompt details:", {
      textContent: firstPrompt.textContent?.substring(0, 200),
      offsetHeight: firstPrompt.offsetHeight,
      color: cs.color,
      visibility: cs.visibility,
      opacity: cs.opacity,
      fontSize: cs.fontSize,
    });
  }

  const header = container.querySelector(".ws-header, header, h1");
  if (header) {
    const cs = getComputedStyle(header as HTMLElement);
    console.log("[PDF-DIAG] Header details:", {
      tag: header.tagName,
      textContent: header.textContent?.substring(0, 100),
      color: cs.color,
      fontSize: cs.fontSize,
      offsetHeight: (header as HTMLElement).offsetHeight,
    });
  }

  const inner = container.firstElementChild as HTMLElement | null;
  console.log("[PDF] Container appended, offsetHeight:", container.offsetHeight, "scrollHeight:", container.scrollHeight);
  console.log("[PDF] Inner element:", {
    tag: inner?.tagName,
    offsetHeight: inner?.offsetHeight,
    scrollHeight: inner?.scrollHeight,
    computedHeight: inner ? getComputedStyle(inner).height : "n/a",
    computedDisplay: inner ? getComputedStyle(inner).display : "n/a",
  });

  const effectiveHeight = Math.max(
    container.scrollHeight,
    inner?.scrollHeight ?? 0,
    1123,
  );

  try {
    await html2pdf()
      .set({
        ...PDF_OPTIONS_BASE,
        filename,
        html2canvas: {
          ...PDF_OPTIONS_BASE.html2canvas,
          height: effectiveHeight,
          windowHeight: effectiveHeight,
        },
      })
      .from(container)
      .save();
    console.log("[PDF] PDF saved");
  } catch (e) {
    console.error("[PDF] html2pdf failed:", e);
    throw e;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Vygeneruje PDF jako Blob URL pro náhled v iframe.
 */
export async function buildWorksheetPdfBlobUrl(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<string> {
  const { html } = await buildWorksheetPdfHtml(spec, options);

  const html2pdfMod: any = await import("html2pdf.js");
  const html2pdf = html2pdfMod.default ?? html2pdfMod;

  const container = buildPdfContainer(html);
  await new Promise((r) => requestAnimationFrame(() => r(null)));

  const effectiveHeight = Math.max(container.scrollHeight, 1123);

  try {
    const pdfBlob: Blob = await html2pdf()
      .set({
        ...PDF_OPTIONS_BASE,
        html2canvas: {
          ...PDF_OPTIONS_BASE.html2canvas,
          height: effectiveHeight,
          windowHeight: effectiveHeight,
        },
      })
      .from(container)
      .outputPdf("blob");
    return URL.createObjectURL(pdfBlob);
  } finally {
    document.body.removeChild(container);
  }
}


/**
 * Export pracovního listu do PDF s QR kódem v hlavičce.
 *
 * Používáme renderWorksheetVariantFragment (style + body bez <html>/<body>)
 * a vkládáme do divu — innerHTML divu nesmí obsahovat <!DOCTYPE>, jinak
 * prohlížeč strukturu rozbije a html2canvas vidí prázdný layout.
 */

import QRCode from "qrcode";
import { renderWorksheetVariantFragment } from "./worksheet-print-renderer";
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
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "pracovni-list"
  );
}

/**
 * Vygeneruje fragment (style + body) pro PDF, s QR kódem v hlavičce.
 */
export async function buildWorksheetPdfFragment(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<{ styleTag: string; bodyHtml: string; filename: string }> {
  const variantId = options.variantId ?? spec.variants[0]?.variantId ?? "A";
  const baseUrl =
    options.baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://zedu.cz");
  const studentUrl = `${baseUrl}/student/pracovni-list/${options.worksheetId}`;

  const specWithConfig: WorksheetSpec = {
    ...spec,
    renderConfig: {
      ...spec.renderConfig,
      includeAnswerKey: !!options.includeAnswerKey,
    },
  };

  const { styleTag, bodyHtml } = renderWorksheetVariantFragment(
    specWithConfig,
    variantId,
    { includeNameField: options.includeNameField },
  );

  const qrDataUrl = await QRCode.toDataURL(studentUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  const qrBlock = `
<div class="ws-qr-wrap" style="text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
  <img src="${qrDataUrl}" alt="QR online verze" style="width:74px;height:74px;display:block;border:1px solid #e2e8f0;border-radius:6px;padding:2px;background:#fff;" />
  <div style="font-size:9px;color:#475569;line-height:1.2;max-width:90px;">Pokračuj online →<br/>${studentUrl.replace(/^https?:\/\//, "")}</div>
</div>`;

  let modifiedBody = bodyHtml;
  const beforeLength = modifiedBody.length;
  modifiedBody = modifiedBody.replace(
    /<div class="ws-header-top">([\s\S]*?)<\/div>\s*<div class="ws-meta-row">/,
    (_m, inner) =>
      `<div class="ws-header-top" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">${inner}${qrBlock}</div>\n  <div class="ws-meta-row">`,
  );
  if (beforeLength === modifiedBody.length) {
    console.warn("[PDF] ws-header-top regex did NOT match.");
  }

  const filename = `pracovni-list-${slugify(spec.header.title)}.pdf`;
  return { styleTag, bodyHtml: modifiedBody, filename };
}

function buildPdfContainer(styleTag: string, bodyHtml: string): HTMLDivElement {
  const container = document.createElement("div");
  // Vlož STYLE tag jako první + body content. Žádné <!DOCTYPE>/<html>/<body>.
  container.innerHTML = styleTag + bodyHtml;
  container.style.position = "absolute";
  container.style.left = "-10000px";
  container.style.top = "0";
  container.style.width = "210mm";
  container.style.minHeight = "297mm";
  container.style.height = "auto";
  container.style.display = "block";
  container.style.background = "white";
  document.body.appendChild(container);
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
  const { styleTag, bodyHtml, filename } = await buildWorksheetPdfFragment(spec, options);
  console.log("[PDF] fragment lengths:", { style: styleTag.length, body: bodyHtml.length });

  const html2pdfMod: any = await import("html2pdf.js");
  const html2pdf = html2pdfMod.default ?? html2pdfMod;

  const container = buildPdfContainer(styleTag, bodyHtml);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  // === DEBUG: ukaž container 5s ===
  container.style.position = "fixed";
  container.style.left = "0";
  container.style.top = "0";
  container.style.zIndex = "99999";
  container.style.border = "3px solid red";
  container.style.background = "white";
  console.log("[PDF-DEBUG] Container is now visible for 5 seconds!");
  await new Promise((r) => setTimeout(r, 5000));
  // ================================

  const items = container.querySelectorAll(".ws-item");
  console.log("[PDF-DIAG] container offsetHeight:", container.offsetHeight, "items:", items.length);
  if (items.length > 0) {
    const first = items[0] as HTMLElement;
    const cs = getComputedStyle(first);
    console.log("[PDF-DIAG] first .ws-item:", {
      offsetHeight: first.offsetHeight,
      color: cs.color,
      visibility: cs.visibility,
      opacity: cs.opacity,
      text: first.textContent?.substring(0, 120),
    });
  }

  const effectiveHeight = Math.max(container.scrollHeight, 1123);

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
  const { styleTag, bodyHtml } = await buildWorksheetPdfFragment(spec, options);

  const html2pdfMod: any = await import("html2pdf.js");
  const html2pdf = html2pdfMod.default ?? html2pdfMod;

  const container = buildPdfContainer(styleTag, bodyHtml);
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

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

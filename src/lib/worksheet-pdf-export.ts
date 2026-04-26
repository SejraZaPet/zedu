/**
 * Export pracovního listu do PDF s QR kódem v hlavičce.
 *
 * Strategie: vykreslíme kompletní HTML dokument do iframe (přes srcdoc),
 * což zajistí korektní aplikaci <style> a layout. Pak předáme
 * iframe.contentDocument.body do html2pdf.
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
 * Vygeneruje kompletní HTML dokument pro PDF (s QR v hlavičce).
 */
export async function buildWorksheetPdfHtml(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<{ html: string; filename: string }> {
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

  const baseHtml = renderWorksheetVariantHtml(specWithConfig, variantId, {
    includeNameField: options.includeNameField,
  });

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

  let html = baseHtml;
  const beforeLength = html.length;
  html = html.replace(
    /<div class="ws-header-top">([\s\S]*?)<\/div>\s*<div class="ws-meta-row">/,
    (_m, inner) =>
      `<div class="ws-header-top" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">${inner}${qrBlock}</div>\n  <div class="ws-meta-row">`,
  );
  if (beforeLength === html.length) {
    console.warn("[PDF] ws-header-top regex did NOT match.");
  }

  const filename = `pracovni-list-${slugify(spec.header.title)}.pdf`;
  return { html, filename };
}

/**
 * Vytvoří off-screen iframe s daným HTML dokumentem a počká na load + layout.
 */
async function buildPdfFrame(html: string): Promise<HTMLIFrameElement> {
  const iframe = document.createElement("iframe");
  iframe.style.position = "absolute";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "1px";
  iframe.style.border = "none";
  iframe.style.background = "white";
  document.body.appendChild(iframe);

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = (e) => reject(e);
    try {
      iframe.srcdoc = html;
    } catch (e) {
      // Fallback přes document.write
      const doc = iframe.contentDocument!;
      doc.open();
      doc.write(html);
      doc.close();
    }
  });

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

  const doc = iframe.contentDocument!;
  const actualHeight = Math.max(
    doc.body.scrollHeight,
    doc.documentElement.scrollHeight,
    1123,
  );
  iframe.style.height = `${actualHeight}px`;

  console.log("[PDF-IFRAME] iframe content height:", actualHeight);
  console.log(
    "[PDF-IFRAME] iframe items:",
    doc.querySelectorAll(".ws-item").length,
  );
  const firstItem = doc.querySelector(".ws-item") as HTMLElement | null;
  if (firstItem) {
    const cs = iframe.contentWindow!.getComputedStyle(firstItem);
    console.log("[PDF-IFRAME] first .ws-item:", {
      offsetHeight: firstItem.offsetHeight,
      color: cs.color,
      visibility: cs.visibility,
      opacity: cs.opacity,
      text: firstItem.textContent?.substring(0, 120),
    });
  }

  return iframe;
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
  console.log("[PDF] html length:", html.length);

  const html2pdfMod: any = await import("html2pdf.js");
  const html2pdf = html2pdfMod.default ?? html2pdfMod;

  const iframe = await buildPdfFrame(html);

  try {
    await html2pdf()
      .set({
        ...PDF_OPTIONS_BASE,
        filename,
      })
      .from(iframe.contentDocument!.body)
      .save();
    console.log("[PDF] PDF saved");
  } catch (e) {
    console.error("[PDF] html2pdf failed:", e);
    throw e;
  } finally {
    document.body.removeChild(iframe);
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

  const iframe = await buildPdfFrame(html);

  try {
    const pdfBlob: Blob = await html2pdf()
      .set({ ...PDF_OPTIONS_BASE })
      .from(iframe.contentDocument!.body)
      .outputPdf("blob");
    return URL.createObjectURL(pdfBlob);
  } finally {
    document.body.removeChild(iframe);
  }
}

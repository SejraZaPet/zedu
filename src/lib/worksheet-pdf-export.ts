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

  // QR jako data URL
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

  // Inject jako pravý sloupec do .ws-header-top.
  // Print renderer dává variantBadge tam – nahradíme ji (nebo přidáme za ni) blokem QR.
  let html = baseHtml;
  // Najdeme uzavírací </div> co následuje po </div>${variantBadge}\n  </div> v ws-header-top.
  // Bezpečný přístup: nahradíme celý ws-header-top regexem.
  html = html.replace(
    /<div class="ws-header-top">([\s\S]*?)<\/div>\s*<div class="ws-meta-row">/,
    (_m, inner) => {
      // odstraníme případnou původní variantBadge a vložíme QR napravo
      return `<div class="ws-header-top" style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">${inner}${qrBlock}</div>\n  <div class="ws-meta-row">`;
    },
  );

  const filename = `pracovni-list-${slugify(spec.header.title)}.pdf`;
  return { html, filename };
}

/**
 * Vygeneruje a stáhne PDF.
 * Volá se z prohlížeče.
 */
export async function downloadWorksheetPdf(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<void> {
  const { html, filename } = await buildWorksheetPdfHtml(spec, options);

  // dynamic import — html2pdf.js sahá na window
  const html2pdfMod: any = await import("html2pdf.js");
  const html2pdf = html2pdfMod.default ?? html2pdfMod;

  // Vytvoříme off-screen container
  const container = document.createElement("div");
  container.innerHTML = html;
  container.style.position = "fixed";
  container.style.left = "-10000px";
  container.style.top = "0";
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 12, 10],
        filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}

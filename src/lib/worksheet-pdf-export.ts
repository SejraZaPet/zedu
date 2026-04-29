/**
 * Export pracovního listu do PDF přes nativní browser print engine.
 *
 * Strategie: vygenerujeme kompletní HTML dokument s vloženým QR kódem,
 * otevřeme nové okno a spustíme window.print(). Uživatel pak v print
 * dialogu zvolí "Uložit jako PDF" nebo Tisk.
 *
 * Výhody oproti html2pdf/html2canvas:
 *   - nativní render zvládá moderní CSS (flex, gap, color, font-size)
 *   - žádná omezení html2canvas
 *   - žádné serverové závislosti
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

/**
 * Vygeneruje kompletní HTML dokument pro tisk (s QR v hlavičce).
 */
async function buildPrintHtml(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<string> {
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
<div class="ws-qr-wrap">
  <img src="${qrDataUrl}" alt="QR online verze" />
  <div>Pokračuj online →<br/>${studentUrl.replace(/^https?:\/\//, "")}</div>
</div>`;

  // Vlož QR do header-top (před uzavírací </div> ws-header-top)
  return baseHtml.replace(
    /<div class="ws-header-top">([\s\S]*?)<\/div>\s*(?=\s*(?:<div class="ws-fields-strip"|<div class="ws-instructions"|<\/div>))/,
    (_m, inner) =>
      `<div class="ws-header-top">${inner}${qrBlock}</div>\n  `,
  );
}

/**
 * Otevře nové okno s pracovním listem a spustí print dialog.
 * Browser pak nabídne uživateli volbu "Uložit jako PDF" nebo Tisk.
 *
 * Signatura zachována kvůli zpětné kompatibilitě — interně ale nyní
 * používáme window.print() místo html2pdf.
 */
export async function downloadWorksheetPdf(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<void> {
  const html = await buildPrintHtml(spec, options);

  const printWindow = window.open("", "_blank", "width=900,height=1000");
  if (!printWindow) {
    console.error("[PDF] Failed to open print window — pop-up blocker?");
    throw new Error(
      "Pop-up okno bylo zablokováno. Povolte pop-upy pro tuto stránku a zkuste znovu.",
    );
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();

  const triggerPrint = () => {
    setTimeout(() => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error("[PDF] window.print() failed:", e);
      }
    }, 350);
  };

  if (printWindow.document.readyState === "complete") {
    triggerPrint();
  } else {
    printWindow.onload = triggerPrint;
  }
}

/**
 * Pro náhled v editoru — vrátí blob URL s HTML dokumentem (s QR).
 * Iframe `src={url}` zobrazí "papírový" náhled díky @media screen pravidlům.
 */
export async function buildWorksheetPdfBlobUrl(
  spec: WorksheetSpec,
  options: PdfExportOptions,
): Promise<string> {
  const html = await buildPrintHtml(spec, options);
  const blob = new Blob([html], { type: "text/html" });
  return URL.createObjectURL(blob);
}

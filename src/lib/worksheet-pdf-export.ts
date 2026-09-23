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
  /** Verze pro učitele: připojí poznámky + klíč v odlišeném rámečku. */
  teacherVersion?: boolean;
  /** Poznámky pro učitele — použijí se POUZE při teacherVersion. */
  teacherNotes?: string;
  /** Base URL for student link (default: window.location.origin). */
  baseUrl?: string;
}

/**
 * Vygeneruje kompletní HTML dokument pro tisk (s QR v hlavičce).
 */
async function buildPrintHtml(
  spec: WorksheetSpec,
  options: PdfExportOptions,
  preview = false,
): Promise<string> {
  const variantId = options.variantId ?? spec.variants[0]?.variantId ?? "A";
  const baseUrl =
    options.baseUrl ??
    (typeof window !== "undefined" ? window.location.origin : "https://bezli.cz");
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
    teacherVersion: !!options.teacherVersion,
    teacherNotes: options.teacherVersion ? options.teacherNotes : undefined,
  });

  const qrDataUrl = await QRCode.toDataURL(studentUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  const qrBlock = `
<div class="ws-qr-wrap">
  <img src="${qrDataUrl}" alt="QR online verze" />
  <div>Pokračuj online →<br/>bezli.cz</div>
</div>`;

  // Vlož QR do header-top (před uzavírací </div> ws-header-top)
  const htmlWithQr = baseHtml.replace(
    /<div class="ws-header-top">([\s\S]*?)<\/div>\s*(?=\s*(?:<div class="ws-fields-strip"|<div class="ws-instructions"|<\/div>))/,
    (_m, inner) =>
      `<div class="ws-header-top">${inner}${qrBlock}</div>\n  `,
  );

  if (!preview) return htmlWithQr;

  const previewScript = `<script>
window.addEventListener("load", function () {
  var sourcePage = document.querySelector(".ws-page");
  var sourceContent = sourcePage && sourcePage.querySelector(":scope > .ws-content");
  var sourceItems = sourceContent && sourceContent.querySelector(":scope > .ws-items");
  if (!sourcePage || !sourceContent || !sourceItems) return;

  document.body.classList.add("ws-preview-paginated");
  var items = Array.from(sourceItems.children);
  sourceItems.replaceChildren();
  var pageHeight = sourceContent.clientHeight;

  function makePage(afterPage) {
    var page = document.createElement("div");
    page.className = "ws-page";
    var content = document.createElement("div");
    content.className = "ws-content";
    var list = document.createElement("div");
    list.className = "ws-items";
    content.appendChild(list);
    page.appendChild(content);
    afterPage.parentNode.insertBefore(page, afterPage.nextSibling);
    return { page: page, content: content, list: list };
  }

  var current = { page: sourcePage, content: sourceContent, list: sourceItems };
  items.forEach(function (item) {
    current.list.appendChild(item);
    if (current.content.scrollHeight > pageHeight + 1 && current.list.children.length > 1) {
      current.list.removeChild(item);
      current = makePage(current.page);
      current.list.appendChild(item);
    }
  });
});
</script>`;

  return htmlWithQr.replace("</body>", previewScript + "\n</body>");
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
  const html = await buildPrintHtml(spec, options, true);
  const blob = new Blob([html], { type: "text/html" });
  return URL.createObjectURL(blob);
}

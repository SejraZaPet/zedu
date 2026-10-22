import { worksheetDocumentTitle } from "@/lib/worksheet-kinds";
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
  /** Napsané odpovědi žáka (jen žákovská verze) — vytisknou se na linkách. */
  answers?: Record<string, unknown> | null;
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
    answers: options.teacherVersion ? null : options.answers ?? null,
  });

  const qrDataUrl = await QRCode.toDataURL(studentUrl, {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });

  const qrBlock = `
<div class="ws-qr-wrap">
  <img src="${qrDataUrl}" alt="QR online verze" />
  <div class="ws-qr-label">Pokračuj online →<br/>bezli.cz</div>
</div>`;

  // Explicitní místo mimo title-block: regex přes vnořené divy vkládal QR
  // dovnitř názvu, rozbíjel tabulkové záhlaví a nadhodnocoval jeho výšku.
  const htmlWithQr = baseHtml.replace("<!--ws-header-qr-->", qrBlock);

  if (!preview) return htmlWithQr;

  const previewScript = `<script>
window.addEventListener("load", async function () {
  document.body.dataset.wsRenderState = "loading";
  try {
  // Rozdělovat až po finálních rozměrech obrázků a písma.
  if (document.fonts) await document.fonts.ready;
  var sourcePage = document.querySelector(".ws-page");
  var sourceContent = sourcePage && sourcePage.querySelector(":scope > .ws-content");
  var sourceItems = sourceContent && sourceContent.querySelector(":scope > .ws-items");
  if (!sourcePage || !sourceContent || !sourceItems) throw new Error("Missing worksheet page");

  document.body.classList.add("ws-preview-paginated");
  var items = Array.from(sourceItems.children);
  sourceItems.replaceChildren();
  var pageHeight = sourceContent.clientHeight;

  function makePage(afterPage) {
    var page = document.createElement("div");
    page.className = sourcePage.className;
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
    // scrollHeight zahrnuje i dolní margin posledního bloku, který na konci
    // stránky není obsah. Měřit skutečný spodní okraj, ne rezervu za ním.
    var usedHeight = item.getBoundingClientRect().bottom - current.content.getBoundingClientRect().top;
    if (usedHeight > pageHeight + 1 && current.list.children.length > 1) {
      current.list.removeChild(item);
      current = makePage(current.page);
      current.list.appendChild(item);
    }
  });

  // Blok učitele / klíč: vždy na novou poslední stránku, dlouhý klíč dělit po řádcích.
  var tail = sourceContent.querySelector(":scope > .ws-teacher-block") || sourceContent.querySelector(":scope > .ws-answer-key");
  if (tail) {
    tail.parentNode.removeChild(tail);
    var keyBox = tail.classList.contains("ws-answer-key") ? tail : tail.querySelector(".ws-answer-key");
    var rows = keyBox ? Array.from(keyBox.querySelectorAll(":scope > .ws-key-item")) : [];
    rows.forEach(function (r) { keyBox.removeChild(r); });
    current = makePage(current.page);
    current.content.appendChild(tail);
    var target = keyBox || tail;
    rows.forEach(function (r) {
      target.appendChild(r);
      var used = r.getBoundingClientRect().bottom - current.content.getBoundingClientRect().top;
      if (used > pageHeight + 1 && target.children.length > 1) {
        target.removeChild(r);
        current = makePage(current.page);
        var cont = document.createElement("div");
        cont.className = target.className + " ws-key-continued";
        current.content.appendChild(cont);
        target = cont;
        target.appendChild(r);
      }
    });
  }
  document.body.dataset.wsRenderState = "ready";
  } catch (_) { document.body.dataset.wsRenderState = "error"; }
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
  // Tiskneme STEJNÝ dokument jako náhled (včetně rozdělení na stránky),
  // a to přes skrytý iframe v aktuální stránce — ne přes pop-up okno.
  // Pop-up okno sdílelo s aplikací jedno vlákno: dokud v něm visel
  // tiskový dialog (nebo zůstalo otevřené za aplikací), aplikace nereagovala.
  const html = await buildPrintHtml(spec, options, true);

  document.querySelectorAll("iframe[data-ws-print-frame]").forEach((el) => el.remove());

  const iframe = document.createElement("iframe");
  iframe.setAttribute("data-ws-print-frame", "true");
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "210mm",
    height: "297mm",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
    zIndex: "-1",
  } as Partial<CSSStyleDeclaration>);

  // Název souboru při „Uložit jako PDF“ bere prohlížeč z titulku stránky.
  const prevTitle = document.title;
  document.title = worksheetDocumentTitle(spec.header.title, spec.header.worksheetMode, spec.header.variantLabel);
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    document.title = prevTitle;
    iframe.remove();
  };

  await new Promise<void>((resolve, reject) => {
    iframe.onload = () => resolve();
    iframe.onerror = () => reject(new Error("Nepodařilo se připravit tisk."));
    iframe.srcdoc = html;
    document.body.appendChild(iframe);
  });

  const win = iframe.contentWindow;
  if (!win) {
    cleanup();
    throw new Error("Nepodařilo se připravit tisk.");
  }

  // Počkat na obrázky a dokončení rozdělení stránek (běží v load handleru).
  await new Promise((r) => setTimeout(r, 300));

  win.addEventListener("afterprint", () => setTimeout(cleanup, 100), { once: true });
  try {
    win.focus();
    win.print();
  } catch (e) {
    console.error("[PDF] print() failed:", e);
    cleanup();
    throw e;
  }
  // Pojistka, kdyby prohlížeč afterprint nevyvolal.
  setTimeout(cleanup, 60_000);
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

/**
 * Žákovská verze: vždy BEZ klíče odpovědí a BEZ poznámek pro učitele.
 * Klíče se ze specifikace odstraní ještě před vykreslením, takže se do HTML
 * nemohou dostat ani omylem.
 */
export function toStudentPrintSpec(spec: WorksheetSpec): WorksheetSpec {
  return {
    ...spec,
    answerKeys: {},
    renderConfig: { ...spec.renderConfig, includeAnswerKey: false },
  };
}

export async function buildStudentWorksheetHtml(
  spec: WorksheetSpec,
  worksheetId: string,
  answers?: Record<string, unknown> | null,
): Promise<string> {
  return buildPrintHtml(toStudentPrintSpec(spec), {
    worksheetId,
    answers: answers ?? null,
    includeAnswerKey: false,
    includeNameField: true,
    teacherVersion: false,
    teacherNotes: undefined,
  }, true);
}

/** Tisk / uložení do PDF pro žáka (prohlížeč nabídne „Uložit jako PDF"). */
export async function printStudentWorksheet(
  spec: WorksheetSpec,
  worksheetId: string,
  answers?: Record<string, unknown> | null,
): Promise<void> {
  return downloadWorksheetPdf(toStudentPrintSpec(spec), {
    worksheetId,
    answers: answers ?? null,
    includeAnswerKey: false,
    includeNameField: true,
    teacherVersion: false,
    teacherNotes: undefined,
  });
}

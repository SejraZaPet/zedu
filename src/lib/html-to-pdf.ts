// Client-side HTML → PDF helper.
// Wraps html2pdf.js so the rest of the app can request a real .pdf download
// (e.g. for sharing or archiving) without relying on window.print().
//
// Usage:
//   import { downloadHtmlAsPdf } from "@/lib/html-to-pdf";
//   await downloadHtmlAsPdf({ html: fullHtmlString, filename: "worksheet.pdf" });
//
// The HTML string should be a complete document (with its own <style>),
// matching what would otherwise be sent to a new window for printing.

// html2pdf.js has no bundled types — we only need the functional surface.
// @ts-ignore
import html2pdf from "html2pdf.js";

export interface DownloadHtmlAsPdfOptions {
  /** Full HTML document (including styles) to render. */
  html: string;
  /** File name for the downloaded PDF (without extension is fine). */
  filename: string;
  /** Page format. Defaults to A4. */
  format?: "a4" | "letter";
  /** Page orientation. Defaults to portrait. */
  orientation?: "portrait" | "landscape";
  /** Margin in mm. Defaults to 12. */
  marginMm?: number;
}

/**
 * Render the supplied HTML off-screen and trigger a PDF download in the browser.
 * Returns a promise that resolves when the download has been initiated.
 */
export async function downloadHtmlAsPdf(opts: DownloadHtmlAsPdfOptions): Promise<void> {
  const {
    html,
    filename,
    format = "a4",
    orientation = "portrait",
    marginMm = 12,
  } = opts;

  const safeName = filename.toLowerCase().endsWith(".pdf") ? filename : `${filename}.pdf`;

  // Render into a hidden iframe so the source document's styles / fonts / scripts
  // do not interfere with the worksheet's print stylesheet.
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.left = "-10000px";
  iframe.style.top = "0";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error("Nepodařilo se připravit dokument pro PDF.");
    doc.open();
    doc.write(html);
    doc.close();

    // Wait for fonts/images inside the iframe before snapshotting.
    await new Promise<void>((resolve) => {
      if (doc.readyState === "complete") return resolve();
      iframe.addEventListener("load", () => resolve(), { once: true });
    });
    if ((doc as any).fonts?.ready) {
      try {
        await (doc as any).fonts.ready;
      } catch {
        /* ignore */
      }
    }

    const target = doc.body;
    await html2pdf()
      .set({
        margin: marginMm,
        filename: safeName,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format, orientation },
        // pagebreak is supported at runtime by html2pdf.js even though
        // its bundled types don't include it.
        ...({ pagebreak: { mode: ["css", "legacy"] } } as Record<string, unknown>),
      })
      .from(target)
      .save();
  } finally {
    iframe.remove();
  }
}

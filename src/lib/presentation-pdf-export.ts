// Export prezentace do PDF na straně klienta.
// Každý slide = jedna stránka A4 na šířku (landscape), poměr 16:9 vycentrovaný.
//
// Slidy se vykreslují mimo obrazovku pomocí stejné komponenty jako editor
// (SlideBody), takže PDF odpovídá tomu, co učitel vidí v náhledu.

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { SlideBody, STAGE_W, STAGE_H } from "@/components/admin/SlideCanvas";
import { getPresentationTheme, themeStageStyle } from "@/lib/presentation-themes";
import { slideBackgroundOverrideStyle } from "@/lib/slide-typography";

function sanitizeFileName(name: string): string {
  return (name || "prezentace")
    .normalize("NFKD")
    .replace(/[^\w\s.-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60) || "prezentace";
}

export async function exportSlidesToPdf(
  slides: any[],
  themeId: string,
  title: string,
): Promise<void> {
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error("Prezentace neobsahuje žádné slidy.");
  }

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const theme = getPresentationTheme(themeId);

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.width = `${STAGE_W}px`;
  host.setAttribute("aria-hidden", "true");
  document.body.appendChild(host);

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "landscape" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (STAGE_H / STAGE_W) * imgW;
  const offsetY = Math.max((pageH - imgH) / 2, 0);

  try {
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      const stage = document.createElement("div");
      stage.style.width = `${STAGE_W}px`;
      stage.style.height = `${STAGE_H}px`;
      stage.style.overflow = "hidden";
      Object.assign(stage.style, themeStageStyle(theme) as any);
      const bg = slideBackgroundOverrideStyle(slide);
      if (bg) {
        stage.style.background = "";
        Object.assign(stage.style, bg);
      }
      host.appendChild(stage);

      const root = createRoot(stage);
      root.render(createElement(SlideBody, { slide, themeId }));

      // Nech React (a případné obrázky/grafy) dokončit vykreslení.
      await new Promise((r) => setTimeout(r, 350));
      if ((document as any).fonts?.ready) {
        try {
          await (document as any).fonts.ready;
        } catch {
          /* ignore */
        }
      }

      const canvas = await html2canvas(stage, {
        scale: 1.5,
        useCORS: true,
        backgroundColor: null,
        logging: false,
        width: STAGE_W,
        height: STAGE_H,
      });

      if (i > 0) pdf.addPage("a4", "landscape");
      pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, offsetY, imgW, imgH);

      root.unmount();
      stage.remove();
    }

    pdf.save(`${sanitizeFileName(title)}.pdf`);
  } finally {
    host.remove();
  }
}

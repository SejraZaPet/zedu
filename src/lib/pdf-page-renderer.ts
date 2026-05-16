import * as pdfjsLib from "pdfjs-dist";

// Worker must match library version exactly
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

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

    await page.render({ canvasContext: ctx, viewport }).promise;

    // JPEG keeps payload reasonable
    const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);
    images.push(imageBase64);
  }

  return images;
}

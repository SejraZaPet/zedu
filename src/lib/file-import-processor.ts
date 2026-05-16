// Client-side file text extraction for textbook import.
// PDF via pdfjs-dist, PPTX via jszip (XML), DOCX via mammoth.

const PDFJS_WORKER_SRC =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib: any = await import("pdfjs-dist");
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_SRC;
  } catch {
    // ignore — some bundles expose differently
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push(`--- Strana ${i} ---\n${pageText}`);
  }
  return pages.join("\n\n");
}

export async function extractTextFromPPTX(file: File): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/slide(\d+)/)?.[1] || "0", 10);
      return numA - numB;
    });

  const slides: string[] = [];
  for (let i = 0; i < slideFiles.length; i++) {
    const xml = await zip.files[slideFiles[i]].async("string");
    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").trim())
      .filter((t) => t.length > 0);
    if (texts.length > 0) {
      slides.push(`--- Slide ${i + 1} ---\n${texts.join("\n")}`);
    }
  }
  return slides.join("\n\n");
}

export async function extractTextFromDOCX(file: File): Promise<string> {
  const mammoth: any = await import("mammoth");
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return (result.value ?? "").trim();
}

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractTextFromPDF(file);
  }
  if (name.endsWith(".pptx")) {
    return extractTextFromPPTX(file);
  }
  if (name.endsWith(".docx")) {
    return extractTextFromDOCX(file);
  }
  throw new Error("Nepodporovaný formát. Podporuje: PDF, DOCX, PPTX.");
}

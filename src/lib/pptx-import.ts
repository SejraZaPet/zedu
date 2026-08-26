/**
 * Přímé parsování .pptx na straně klienta — BEZ AI.
 *
 * Cíl: 1 snímek PPTX = 1 slide v Bezli (přesně N ku N). PPTX je ZIP archiv,
 * takže stačí rozbalit `ppt/slides/slideN.xml` a vytáhnout texty z `<a:t>`.
 * Obrázky (`ppt/media/`) v této verzi vědomě nepřenášíme — správný počet
 * snímků je důležitější než obrázky na špatných místech.
 */

export interface PptxShapeText {
  /** Je shape titulkový placeholder? */
  isTitle: boolean;
  /** Řádky textu shapu (jeden řádek = jeden `<a:p>`). */
  lines: string[];
  /** Alespoň jeden odstavec má odrážku. */
  bulleted: boolean;
}

export interface PptxSlideText {
  slideNumber: number;
  shapes: PptxShapeText[];
}

const TITLE_PH_TYPES = new Set(["title", "ctrTitle"]);

const collapse = (s: string) => s.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim();

function el(parent: Element | Document, tag: string): Element[] {
  return Array.from(parent.getElementsByTagName(tag));
}

/** Text a odrážky jednoho `<p:sp>`. */
function readShape(sp: Element): PptxShapeText | null {
  const ph = el(sp, "p:ph")[0];
  const phType = ph?.getAttribute("type") ?? "";
  const isTitle = TITLE_PH_TYPES.has(phType);

  const lines: string[] = [];
  let bulleted = false;

  for (const p of el(sp, "a:p")) {
    const text = collapse(el(p, "a:t").map((t) => t.textContent ?? "").join(""));
    if (!text) continue;
    lines.push(text);

    const pPr = el(p, "a:pPr")[0];
    const hasNone = pPr ? el(pPr, "a:buNone").length > 0 : false;
    const hasBullet = pPr
      ? el(pPr, "a:buChar").length > 0 || el(pPr, "a:buAutoNum").length > 0
      : false;
    const indented = Number(pPr?.getAttribute("lvl") ?? "0") > 0;
    if (!hasNone && (hasBullet || indented)) bulleted = true;
  }

  if (lines.length === 0) return null;
  return { isTitle, lines, bulleted };
}

/** Rozparsuje XML jednoho snímku na shapy s textem. */
export function parseSlideXml(xml: string, slideNumber: number): PptxSlideText {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const shapes: PptxShapeText[] = [];
  for (const sp of el(doc, "p:sp")) {
    const shape = readShape(sp);
    if (shape) shapes.push(shape);
  }
  return { slideNumber, shapes };
}

/** Sestaví jeden slide Bezli z textů snímku. */
export function slideFromPptxText(
  slide: PptxSlideText,
  themeId?: string,
): Record<string, any> {
  const shapes = [...slide.shapes];
  const titleIdx = shapes.findIndex((s) => s.isTitle);
  const idx = titleIdx >= 0 ? titleIdx : shapes.length > 0 ? 0 : -1;
  const headline = idx >= 0 ? shapes[idx].lines.join(" ") : "";
  const rest = idx >= 0 ? shapes.filter((_, i) => i !== idx) : [];

  const blocks: Record<string, any>[] = [];
  for (const shape of rest) {
    if (shape.bulleted && shape.lines.length > 1) {
      blocks.push({
        id: crypto.randomUUID(),
        type: "bullet_list",
        visible: true,
        props: { items: shape.lines },
      });
    } else {
      blocks.push({
        id: crypto.randomUUID(),
        type: "paragraph",
        visible: true,
        props: { text: shape.lines.join("\n") },
      });
    }
  }

  return {
    slideId: crypto.randomUUID(),
    type: "content",
    projector: { headline, body: "" },
    device: { instructions: "" },
    blocks,
    ...(themeId ? { themeId } : {}),
  };
}

/** Hlavní vstup: .pptx soubor → pole slidů (1:1 se snímky). */
export async function parsePptxFileToSlides(
  file: File | Blob,
  themeId?: string,
): Promise<Record<string, any>[]> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());

  const slidePaths = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .map((name) => ({ name, num: Number(name.match(/slide(\d+)\.xml$/)![1]) }))
    .sort((a, b) => a.num - b.num);

  if (slidePaths.length === 0) {
    throw new Error("V souboru se nepodařilo najít žádné snímky prezentace.");
  }

  const slides: Record<string, any>[] = [];
  for (const { name, num } of slidePaths) {
    const xml = await zip.files[name].async("string");
    slides.push(slideFromPptxText(parseSlideXml(xml, num), themeId));
  }
  return slides;
}

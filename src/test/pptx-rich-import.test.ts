import { describe, it, expect, vi } from "vitest";
import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import { importRichPptx } from "@/lib/pptx-rich-import";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function makeDeck(count = 20) {
  const p = new pptxgen(); p.layout = "LAYOUT_WIDE"; p.author = "[TEST]"; p.defineSlideMaster({ title: "MASTER", background: { color: "663196" }, objects: [] });
  for (let i = 0; i < count; i++) {
    const s = p.addSlide({ masterName: "MASTER" });
    if (i % 2 === 0) s.background = { data: PNG };
    s.addText(i === 0 ? "Věda kolem nás" : `NÁZEV ${i + 1}`, { x: 0.5, y: 0.3, w: 12.2, h: 0.6, fontSize: 32, bold: true, color: "FFFFFF", fontFace: "Oswald" });
    s.addShape(p.ShapeType.roundRect, { x: 0.6, y: 1.3, w: 5.8, h: 2.1, fill: { color: "F3F1E6" }, line: { color: "663196", width: 1 }, rectRadius: 0.12 });
    s.addText(`Text karty ${i + 1}`, { x: 0.85, y: 1.55, w: 5.2, h: 0.6, fontSize: 22, color: "2B1A3F", italic: i === 1 });
    s.addShape(p.ShapeType.roundRect, { x: 7, y: 1.4, w: 2.4, h: 0.5, fill: { color: "63C7CF" }, line: { color: "63C7CF", transparency: 100 }, rectRadius: 0.25 });
    s.addText("PILULKA", { x: 7, y: 1.43, w: 2.4, h: 0.35, fontSize: 14, align: "center", color: "2B1A3F" });
    if (i === 0) s.addImage({ data: PNG, x: 0, y: 4.2, w: 13.333, h: 3.3 });
    s.addNotes(`Poznámka řečníka ${i + 1}`);
  }
  const buffer = await p.write({ outputType: "arraybuffer" }) as ArrayBuffer;
  // Ověříme schemeClr a skutečné cap=all, ne jen ručně převedená velká písmena.
  const zip = await JSZip.loadAsync(buffer); const path = "ppt/slides/slide1.xml"; let xml = await zip.file(path)!.async("string");
  xml = xml.replace('val="FFFFFF"', 'val="bg1"').replace("<a:srgbClr val=\"bg1\"", "<a:schemeClr val=\"bg1\"");
  xml = xml.replace(/<a:rPr(?![^>]*cap=)([^>]*)>/, '<a:rPr$1 cap="all">');
  zip.file(path, xml); return zip.generateAsync({ type: "uint8array" });
}

describe("věrný PPTX import", () => {
  it("přenese 20 slidů, styly, tvary, poznámky a deduplikuje obrázky", async () => {
    const bytes = await makeDeck(); const upload = vi.fn(async ({ hash }: any) => `https://img.test/${hash}.png`);
    const result = await importRichPptx(new Blob([new Uint8Array(bytes)]), { uploadImage: upload, themeId: "nature" });
    expect(result.slides).toHaveLength(20); expect(result.summary.textElements).toBeGreaterThanOrEqual(60); expect(result.summary.shapes).toBeGreaterThanOrEqual(40);
    expect(result.slides.every((s) => s.teacherNotes.includes("Poznámka řečníka"))).toBe(true);
    const firstText = result.slides[0].blocks.find((b) => b.props.text?.includes("VĚDA"));
    expect(firstText).toBeTruthy(); expect(firstText.props.color).toBe("#FFFFFF"); expect(firstText.frame.x).toBeGreaterThanOrEqual(0); expect(firstText.zIndex).toBeGreaterThan(0);
    expect(result.slides[0].blocks.some((b) => b.type === "shape" && b.props.fillColor === "#F3F1E6")).toBe(true);
    expect(result.slides[0].blocks.some((b) => b.type === "shape" && b.props.fillColor === "#63C7CF")).toBe(true);
    expect(result.slides[0].blocks.some((b) => b.type === "image")).toBe(true);
    expect(result.slides[0].backgroundOverride.image).toContain("https://img.test/"); expect(result.slides[1].backgroundOverride.color).toBe("#663196");
    expect(upload).toHaveBeenCalledTimes(1); expect(result.summary.images).toBe(1); // full-bleed obrázek na titulním slidu
  }, 30000);
});

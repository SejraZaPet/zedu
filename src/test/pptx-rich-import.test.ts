import { describe, it, expect, vi } from "vitest";
import pptxgen from "pptxgenjs";
import JSZip from "jszip";
import { importRichPptx } from "@/lib/pptx-rich-import";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

async function makeDeck(count = 20) {
  const p = new pptxgen(); p.layout = "LAYOUT_WIDE"; p.author = "[TEST]"; p.defineSlideMaster({ title: "MASTER", background: { color: "111827" }, objects: [] });
  for (let i = 0; i < count; i++) {
    const s = p.addSlide({ masterName: "MASTER" });
    // Stejný vzor jako Tynina přednáška: 12 plných a 8 obrázkových pozadí.
    s.background = i < Math.ceil(count * 0.6) ? { color: "5D3D7F" } : { data: PNG };
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
    expect(result.slides.slice(0, 12).every((s) => s.backgroundOverride.color === "#5D3D7F")).toBe(true);
    expect(result.slides.slice(12).every((s) => s.backgroundOverride.image?.includes("https://img.test/"))).toBe(true);
    expect(firstText.props.fontSize).toBe(32);
    expect(result.slides[0].blocks.find((b) => b.props.text?.includes("Text karty"))?.props.fontSize).toBe(22);
    expect(result.slides[0].blocks.find((b) => b.props.text?.includes("PILULKA"))?.props.fontSize).toBe(14);
    expect(upload).toHaveBeenCalledTimes(1); expect(result.summary.images).toBe(1); // summary.images počítá obrázky prvků, ne pozadí
  }, 30000);

  it("přečte nativní přechod, směr a délku; chybějící přechod zůstane bez animace", async () => {
    const bytes = await makeDeck(3);
    const zip = await JSZip.loadAsync(bytes);
    const transitions = [
      '<p:transition spd="slow"><p:push dir="d"/></p:transition>',
      '<p:transition spd="fast"><p:prism/></p:transition>',
    ];
    for (const [index, transition] of transitions.entries()) {
      const path = `ppt/slides/slide${index + 1}.xml`;
      const source = await zip.file(path)!.async("string");
      zip.file(path, source.replace("</p:clrMapOvr>", `</p:clrMapOvr>${transition}`));
    }
    const result = await importRichPptx(new Blob([new Uint8Array(await zip.generateAsync({ type: "uint8array" }))]));
    expect(result.slides[0]).toMatchObject({ transitionStyle: "push", transitionDirection: "down", transitionDuration: 1.4 });
    expect(result.slides[1]).toMatchObject({ transitionStyle: "fade", transitionDuration: 0.35 });
    expect(result.slides[2].transitionStyle).toBe("cut");
    expect(result.summary.warnings.some((warning) => warning.includes("prism"))).toBe(true);
  }, 30000);

  it("přečte výplň z bgRef motivu a velikost písma z pPr/defRPr", async () => {
    const bytes = await makeDeck(2);
    const zip = await JSZip.loadAsync(bytes);
    for (const [index, reference] of [[1, 1001], [2, 1002]] as const) {
      const path = `ppt/slides/slide${index}.xml`;
      let source = await zip.file(path)!.async("string");
      source = source.replace(/<p:bg>[\s\S]*?<\/p:bg>/, `<p:bg><p:bgRef idx="${reference}"><a:schemeClr val="bg1"/></p:bgRef></p:bg>`);
      if (index === 1) {
        source = source.replace(/<a:rPr([^>]*?)\s*sz="3200"/, '<a:rPr$1');
        source = /<a:pPr\s[^>]*>/.test(source) || source.includes("<a:pPr>")
          ? source.replace(/<a:pPr([^>]*)>/, '<a:pPr$1><a:defRPr sz="3400"/>')
          : source.replace("<a:pPr/>", '<a:pPr><a:defRPr sz="3400"/></a:pPr>');
      }
      zip.file(path, source);
    }
    const themePath = "ppt/theme/theme1.xml";
    const theme = await zip.file(themePath)!.async("string");
    const fills = '<a:bgFillStyleLst><a:solidFill><a:srgbClr val="5D3D7F"/></a:solidFill><a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="5D2A8C"/></a:gs><a:gs pos="100000"><a:srgbClr val="4FB3BE"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:bgFillStyleLst>';
    zip.file(themePath, theme.replace(/<a:bgFillStyleLst>[\s\S]*?<\/a:bgFillStyleLst>/, fills));
    const result = await importRichPptx(new Blob([new Uint8Array(await zip.generateAsync({ type: "uint8array" }))]), { uploadImage: async () => "https://img.test/unused.png" });
    expect(result.slides[0].backgroundOverride.color).toBe("#5D3D7F");
    expect(result.slides[1].backgroundOverride.gradient).toMatchObject({ from: "#5D2A8C", to: "#4FB3BE" });
    const title = result.slides[0].blocks.find((b) => b.props.text?.includes("VĚDA"));
    expect(title?.props.fontSize).toBe(34);
  }, 30000);
});

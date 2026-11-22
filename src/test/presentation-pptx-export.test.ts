import { describe, it, expect, vi } from "vitest";
import { createPresentationPptx, sanitizePresentationPptx } from "@/lib/presentation-pptx-export";
import { importRichPptx } from "@/lib/pptx-rich-import";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
const textOf = (slide: any) => slide.blocks.map((b: any) => b.props.text || "").join("\n").replace(/<[^>]+>/g, "");

describe("PPTX export editoru a zpětný import", () => {
  it("zachová text, tvary, obrázek, aktivitu a poznámky", async () => {
    const source = [
      { slideId: "a", type: "content", projector: { headline: "" }, backgroundOverride: { color: "#663196" }, teacherNotes: "Poznámka pouze pro učitele", blocks: [
        { id: "t", type: "heading", visible: true, frame: { x: 5, y: 5, w: 90, h: 10 }, props: { text: "ROUND TRIP NADPIS", fontSize: 34, bold: true, color: "#FFFFFF", fontFamily: "Oswald" } },
        { id: "s", type: "shape", visible: true, frame: { x: 10, y: 25, w: 45, h: 25 }, props: { shapeKind: "rounded-rect", fillColor: "#F3F1E6", strokeColor: "#663196", text: "Text uvnitř karty", fontSize: 22, color: "#2B1A3F" } },
        { id: "i", type: "image", visible: true, frame: { x: 65, y: 25, w: 25, h: 25 }, props: { url: PNG, objectFit: "contain" } },
      ] },
      { slideId: "b", type: "activity", projector: { headline: "Kvíz" }, teacherNotes: "Spustit po diskuzi", activitySpec: { activityType: "mcq", question: "Hlavní město?", options: [{ text: "Praha" }, { text: "Brno" }], correctIndex: 0 }, blocks: [] },
    ];
    const pptx = await createPresentationPptx(source, "[TEST] roundtrip"); const raw = await pptx.write({ outputType: "uint8array" }) as Uint8Array;
    const output = await sanitizePresentationPptx(new Uint8Array(raw));
    const JSZip = (await import("jszip")).default; const packed = await JSZip.loadAsync(output);
    const types = await packed.file("[Content_Types].xml")!.async("string");
    for (const match of types.matchAll(/<Override\b[^>]*PartName="([^"]+)"/g)) expect(packed.file(match[1].replace(/^\//, ""))).toBeTruthy();
    const presentation = await packed.file("ppt/presentation.xml")!.async("string"); expect(presentation.indexOf("p:notesMasterIdLst")).toBeLessThan(presentation.indexOf("p:sldIdLst"));
    const upload = vi.fn(async () => PNG); const imported = await importRichPptx(new Blob([new Uint8Array(output)]), { uploadImage: upload });
    expect(imported.slides).toHaveLength(2); expect(textOf(imported.slides[0])).toContain("ROUND TRIP NADPIS"); expect(textOf(imported.slides[0])).toContain("Text uvnitř karty");
    expect(imported.slides[0].teacherNotes).toContain("Poznámka pouze pro učitele"); expect(textOf(imported.slides[1])).toContain("Hlavní město?"); expect(textOf(imported.slides[1])).toContain("Praha"); expect(textOf(imported.slides[1])).toContain("Brno"); expect(imported.slides[1].teacherNotes).toContain("Spustit po diskuzi");
    expect(imported.slides[0].blocks.some((b: any) => b.type === "image")).toBe(true); expect(imported.slides[0].blocks.some((b: any) => b.type === "shape")).toBe(true);
  }, 30000);
});

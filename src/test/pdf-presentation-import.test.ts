import { describe, it, expect } from "vitest";
import { assertPdfImportLimits, pdfTextItemsToBlocks, PDF_IMPORT_MAX_PAGES } from "@/lib/pdf-presentation-import";

describe("PDF import do prezentace", () => {
  it("hlásí limity velikosti a počtu stran", () => {
    expect(() => assertPdfImportLimits(60 * 1024 * 1024 + 1, 1)).toThrow(/60 MB/);
    expect(() => assertPdfImportLimits(1000, PDF_IMPORT_MAX_PAGES + 1)).toThrow(/nejvýše 50/);
    expect(() => assertPdfImportLimits(1000, 0)).toThrow(/neobsahuje/);
  });
  it("převede skutečnou textovou vrstvu na pozicované upravitelné prvky", () => {
    const blocks = pdfTextItemsToBlocks([{ str: "Upravitelný text", transform: [20, 0, 0, 20, 72, 720], width: 180 }], 612, 792);
    expect(blocks).toHaveLength(1); expect(blocks[0].props.text).toBe("Upravitelný text"); expect(blocks[0].frame.x).toBeCloseTo(11.76, 1); expect(blocks[0].frame.y).toBeLessThan(10); expect(blocks[0].props.pdfTextLayer).toBe(true); expect(blocks[0].props.color).toBe("transparent"); expect(blocks[0].props.sourceTextColor).toBe("#2B1A3F");
    expect(pdfTextItemsToBlocks([{ str: "   ", transform: [1, 0, 0, 1, 0, 0] }], 612, 792)).toEqual([]);
  });
});

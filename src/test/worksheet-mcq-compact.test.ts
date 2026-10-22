import { describe, it, expect } from "vitest";
import { buildWorksheetCss, renderWorksheetVariantHtml, mcqColumns } from "@/lib/worksheet-print-renderer";
import { WORKSHEET_SPEC_EXAMPLE, type WorksheetSpec, type WorksheetItem } from "@/lib/worksheet-spec";
import { createDefaultItem } from "@/lib/worksheet-defaults";

const spec = (items: WorksheetItem[]): WorksheetSpec => ({
  ...WORKSHEET_SPEC_EXAMPLE,
  variants: [{ ...WORKSHEET_SPEC_EXAMPLE.variants[0], items }],
});
const mcq = (choices: string[]) => ({ ...createDefaultItem("mcq", 1), choices } as WorksheetItem);

describe("kompaktní výběr z možností", () => {
  it("4 krátké možnosti → 2 sloupce", () => expect(mcqColumns(["a", "b", "c", "d"])).toBe(2));
  it("jedna dlouhá možnost → 1 sloupec", () => expect(mcqColumns(["a", "b", "c", "x".repeat(39)])).toBe(1));
  it("5 možností → 1 sloupec", () => expect(mcqColumns(["a", "b", "c", "d", "e"])).toBe(1));
  it("HTML má čtverečky, písmena a dva sloupce", () => {
    const html = renderWorksheetVariantHtml(spec([mcq(["Ano", "Ne", "Možná", "Nevím"])]), "A");
    expect(html).toContain("ws-choices--2col");
    expect((html.match(/class="ws-choice-box"/g) ?? []).length).toBe(4);
    for (const l of ["A)", "B)", "C)", "D)"]) expect(html).toContain(l);
  });
  it("compact řádkování 1.15 je menší než normal", () => {
    const css = buildWorksheetCss();
    expect(css).toMatch(/\.ws-page \{[^}]*--ws-choice-lh: 1\.15/);
    expect(css).toMatch(/\.ws-density-normal \{[^}]*--ws-choice-lh: 1\.25/);
  });
});

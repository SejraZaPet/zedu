import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { buildWorksheetCss, renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";
import { WORKSHEET_SPEC_EXAMPLE, type WorksheetSpec, type WorksheetItem } from "@/lib/worksheet-spec";
import { createDefaultItem } from "@/lib/worksheet-defaults";
import { WRITE_LINE_HEIGHT_MM, createWriteLinePatch } from "@/lib/worksheet-write-lines";
import LayoutBlockItem from "@/components/worksheet-items/LayoutBlockItem";

const withItems = (items: WorksheetItem[], density?: any): WorksheetSpec => ({
  ...WORKSHEET_SPEC_EXAMPLE,
  header: { ...WORKSHEET_SPEC_EXAMPLE.header, ...(density ? { printDensity: density } : {}) },
  variants: [{ ...WORKSHEET_SPEC_EXAMPLE.variants[0], items }],
});

const varBlock = (css: string, sel: string) => css.slice(css.indexOf(sel + " {"), css.indexOf("}", css.indexOf(sel + " {")));
const mm = (block: string) => parseFloat(block.match(/--ws-item-gap:\s*([\d.]+)mm/)![1]);

describe("hustota tisku", () => {
  it("compact má menší mezery než normal", () => {
    const css = buildWorksheetCss();
    expect(mm(varBlock(css, ".ws-page"))).toBe(4);
    expect(mm(varBlock(css, ".ws-page.ws-density-normal"))).toBe(7);
    expect(mm(varBlock(css, ".ws-page.ws-density-loose"))).toBe(10);
  });
  it("starý list bez pole se vykreslí jako kompaktní", () => {
    const html = renderWorksheetVariantHtml(withItems(WORKSHEET_SPEC_EXAMPLE.variants[0].items), "A");
    expect(html).toContain('class="ws-page ws-density-compact"');
    expect(renderWorksheetVariantHtml(withItems([], "loose"), "A")).toContain("ws-density-loose");
  });
});

describe("řádky pro psaní", () => {
  it("tisk, editor i model mají stejnou výšku řádku", () => {
    const item = createDefaultItem("write_lines", 1);
    const html = renderWorksheetVariantHtml(withItems([item]), "A");
    expect(html).toContain(`height:${WRITE_LINE_HEIGHT_MM}mm`);
    const { container } = render(<LayoutBlockItem item={item} value={undefined} onChange={() => {}} disabled showResults={false} />);
    const line = container.querySelector('[data-testid="write-lines-static"] > div') as HTMLElement;
    expect(line.style.height).toBe(`${WRITE_LINE_HEIGHT_MM}mm`);
    expect(createWriteLinePatch(item, 4).answerSpace.heightMm).toBe(4 * WRITE_LINE_HEIGHT_MM);
  });
});

describe("blank_box", () => {
  it("vykreslí se s danou výškou, nerozdělí se a nečísluje", () => {
    const item = { ...createDefaultItem("blank_box", 1), heightMm: 60 };
    expect(item.points).toBe(0);
    const html = renderWorksheetVariantHtml(withItems([item]), "A");
    expect(html).toContain('class="ws-blank-box"');
    expect(html).toContain("height:60mm");
    expect(html).not.toContain("ws-item-num");
    expect(varBlock(buildWorksheetCss(), ".ws-blank-box")).toContain("break-inside: avoid");
  });
});

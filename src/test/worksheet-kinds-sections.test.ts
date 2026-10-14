import { describe, it, expect } from "vitest";
import { parseSections, missingByType, assembleSections, projectBriefToItems } from "../../supabase/functions/_shared/worksheet-sections";
import { sanitizeSections, sectionTotals, worksheetKindPrintLabel, worksheetDocumentTitle, normalizeWorksheetKind, SECTION_PRESETS } from "@/lib/worksheet-kinds";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";
const renderWorksheetHtml = (s: any) => renderWorksheetVariantHtml(s, s.variants[0].variantId);
import { emptyWorksheetSpec as createDefaultSpec } from "@/lib/worksheet-defaults";

describe("sekce AI listu", () => {
  const req = sanitizeSections([
    { type: "mcq", count: 3, pointsPerItem: 2, title: "Výběr" },
    { type: "true_false", count: 2, pointsPerItem: null },
  ]);
  it("součty v dialogu", () => {
    expect(sectionTotals(req)).toEqual({ questions: 5, points: 8 });
    expect(sectionTotals(SECTION_PRESETS.quick_test.sections).questions).toBe(10);
  });
  it("server dodrží přesné počty, ořízne přebytek a doplní chybějící", () => {
    const secs = parseSections(req)!;
    const pool = [
      ...Array.from({ length: 5 }, (_, i) => ({ type: "mcq", prompt: `Q${i}`, points: 1 })),
      { type: "true_false", prompt: "T1" },
      { type: "section_header", prompt: "x" },
    ];
    expect(missingByType(secs, pool)).toEqual({ true_false: 1 });
    const out = assembleSections(secs, pool);
    expect(out.filter((i) => i.type === "mcq")).toHaveLength(3);
    expect(out.filter((i) => i.type === "true_false")).toHaveLength(2);
    expect(out.filter((i) => i.type === "mcq").every((i) => i.points === 2)).toBe(true);
    expect(out[0]).toMatchObject({ type: "section_header", prompt: "Výběr" });
  });
  it("bez sekcí zůstává starý režim", () => {
    expect(parseSections(undefined)).toBeNull();
    expect(parseSections([{ type: "evil", count: 3 }])).toBeNull();
  });
  it("projekt má kritéria a blank_box", () => {
    const items = projectBriefToItems({ goal: "G", steps: ["a", "b"], output: "O", criteria: [{ criterion: "Kvalita", points: 5 }] });
    expect(items.some((i) => i.type === "table" && i.tableRows.at(-1)[1] === "5")).toBe(true);
    expect(items.at(-1).type).toBe("blank_box");
  });
});

describe("druh listu", () => {
  it("štítek v tisku a název PDF", () => {
    expect(worksheetKindPrintLabel("project")).toBe("PROJEKT");
    expect(worksheetKindPrintLabel("classwork")).toBe("");
    expect(worksheetDocumentTitle("Maso", "test")).toBe("Test – Maso");
    expect(worksheetDocumentTitle("Maso", "classwork")).toBe("Maso");
    expect(normalizeWorksheetKind("study")).toBe("classwork");
  });
  it("renderer: TEST nad názvem, classwork bez štítku", () => {
    const s = createDefaultSpec({ title: "Maso", worksheetMode: "test" } as any);
    const html = renderWorksheetHtml(s);
    expect(html).toContain('class="ws-kind-label"');
    expect(html).toContain("<title>Test – Maso</title>");
    const c = createDefaultSpec({ title: "Maso", worksheetMode: "classwork" } as any);
    const h2 = renderWorksheetHtml(c);
    expect(h2).not.toContain('class="ws-kind-label"');
    expect(h2).toContain("<title>Maso</title>");
  });
});

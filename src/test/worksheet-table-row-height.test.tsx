import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TableItem from "@/components/worksheet-items/TableItem";
import { renderWorksheetVariantHtml } from "@/lib/worksheet-print-renderer";
import type { WorksheetItem, WorksheetSpec } from "@/lib/worksheet-spec";

const tableItem: WorksheetItem = {
  id: "table",
  itemNumber: 1,
  type: "table",
  prompt: "Doplňte tabulku",
  points: 0,
  difficulty: "easy",
  timeEstimateSec: 60,
  answerSpace: { type: "none", heightMm: 0 },
  tableRows: [["Pojem", "Odpověď"], ["", ""]],
};

describe("worksheet table writing space", () => {
  it("keeps body rows tall enough on the live A4 canvas", () => {
    const html = renderToStaticMarkup(
      <TableItem
        item={tableItem}
        value={undefined}
        onChange={() => undefined}
        disabled
        showResults={false}
      />,
    );

    expect(html).toContain("h-[10mm]");
    expect(html).toContain("py-[2mm]");
  });

  it("uses the same 10 mm body-row height in print and PDF HTML", () => {
    const spec: WorksheetSpec = {
      specVersion: "v1",
      worksheetId: "table-row-height-test",
      title: "Test",
      subject: "Test",
      grade: 1,
      language: "cs-CZ",
      variants: [{ variantId: "A", seed: 1, items: [tableItem] }],
      answerKeys: { A: [] },
      randomizationRules: [],
      header: {
        title: "Test",
        subject: "Test",
        gradeBand: "1. ročník",
        worksheetMode: "classwork",
        studentNameField: true,
        dateField: false,
        classField: false,
      },
      renderConfig: {
        target: "print",
        showPoints: false,
        pointsEnabled: false,
        includeAnswerKey: false,
      },
    };

    const html = renderWorksheetVariantHtml(spec, "A");
    expect(html).toContain(".ws-content-table tbody td");
    expect(html).toContain("height: 10mm");
    expect(html).toContain('<table class="ws-content-table">');
  });
});
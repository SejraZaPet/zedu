import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import TableItem from "@/components/worksheet-items/TableItem";
import { isItemAnswered, scoreWorksheet } from "@/components/WorksheetPlayer";
import { hasEditableTableCells, isTableCellEditable, setTableCellAnswer, tableCellAnswer } from "@/lib/worksheet-table";
import type { WorksheetItem } from "@/lib/worksheet-spec";

const base = (over: Partial<WorksheetItem>): WorksheetItem => ({
  id: "t", itemNumber: 1, type: "table", prompt: "", points: 3, difficulty: "easy",
  timeEstimateSec: 0, answerSpace: { type: "none", heightMm: 0 },
  tableRows: [["Pojem", "Význam"], ["Sešit", ""]], ...over,
} as WorksheetItem);

describe("vyplnitelná tabulka", () => {
  it("prázdná buňka mimo hlavičku je k vyplnění, hlavička a text ne", () => {
    const t = base({});
    expect(isTableCellEditable(t, 0, 1)).toBe(false);
    expect(isTableCellEditable(t, 1, 0)).toBe(false);
    expect(isTableCellEditable(t, 1, 1)).toBe(true);
  });
  it("starý list s pevnou tabulkou zůstane bez buněk k vyplnění", () => {
    expect(hasEditableTableCells(base({ tableRows: [["A", "B"], ["1", "2"]] }))).toBe(false);
  });
  it("učitel může buňku vypnout", () => {
    expect(hasEditableTableCells(base({ tableEditable: [[false, false], [false, false]] }))).toBe(false);
  });
  it("uloží a obnoví hodnotu buňky jako string[]", () => {
    const t = base({});
    const v = setTableCellAnswer(t, undefined, 1, 1, "kniha");
    expect(v).toEqual(["", "kniha"]);
    expect(tableCellAnswer(t, v, 1, 1)).toBe("kniha");
    expect(isItemAnswered(t, v)).toBe(true);
    expect(isItemAnswered(t, ["", ""])).toBe(false);
  });
  it("tabulka nemění skóre ani maximum", () => {
    const r = scoreWorksheet([base({})], { t: ["", "x"] }, []);
    expect(r.maxScore).toBe(0);
    expect(r.score).toBe(0);
  });
  it("buňka je textarea bez blokování dotyku", () => {
    const html = renderToStaticMarkup(<TableItem item={base({})} value={["", "x"]} onChange={() => {}} disabled={false} showResults={false} />);
    expect(html).toContain("<textarea");
    expect(html).not.toContain("touch-none");
  });
});

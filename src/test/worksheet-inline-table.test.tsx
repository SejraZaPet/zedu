import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import TableItem from "@/components/worksheet-items/TableItem";
import TableFieldsEditor from "@/components/worksheet/TableFieldsEditor";
import { applyWorksheetInlineTextEdit } from "@/lib/worksheet-inline-edit";
import { updateTableCellText } from "@/lib/worksheet-table";
import { createDefaultItem, emptyWorksheetSpec } from "@/lib/worksheet-defaults";
import type { WorksheetItem } from "@/lib/worksheet-spec";

const props = { value: undefined, onChange: () => undefined, disabled: true, showResults: false } as const;
const table = (over: Partial<WorksheetItem> = {}): WorksheetItem => ({
  ...createDefaultItem("table", 1),
  tableRows: [["Pojem", "Význam"], ["Sešit", ""], ["Pero", "Psací potřeba"]],
  tableEditable: [[false, false], [false, true], [false, false]],
  ...over,
});

describe("inline úprava pevných buněk tabulky", () => {
  it("hlavička i pevná buňka zapíší cestu řádek/sloupec až po blur", () => {
    const edit = vi.fn();
    render(<TableItem {...props} item={table()} onEditText={edit} />);
    const header = screen.getByLabelText("Hlavička 2");
    fireEvent.change(header, { target: { value: "Nový" } });
    fireEvent.change(header, { target: { value: "Nový význam" } });
    expect(edit).not.toHaveBeenCalled();
    fireEvent.blur(header);
    expect(edit).toHaveBeenCalledTimes(1);
    expect(edit).toHaveBeenCalledWith("tableRows.0.1", "Nový význam");

    const fixed = screen.getByLabelText("Buňka řádek 3, sloupec 2");
    fireEvent.change(fixed, { target: { value: "Tužka" } });
    fireEvent.blur(fixed);
    expect(edit).toHaveBeenCalledWith("tableRows.2.1", "Tužka");
  });

  it("žákovská buňka k vyplnění zůstane stávajícím disabled textarea", () => {
    const edit = vi.fn();
    render(<TableItem {...props} item={table()} onEditText={edit} />);
    const answer = screen.getByLabelText("Řádek 1, sloupec 2 (Význam)");
    expect(answer).toBeDisabled();
    expect(answer).toHaveValue("");
    expect(screen.queryByLabelText("Buňka řádek 2, sloupec 2")).toBeNull();
    fireEvent.change(answer, { target: { value: "neměnit" } });
    expect(edit).not.toHaveBeenCalled();
  });

  it("bez onEditText zůstane celá tabulka jako dřív", () => {
    const { container } = render(<TableItem {...props} item={table()} />);
    expect(container.querySelectorAll("textarea")).toHaveLength(1);
    expect(screen.getByText("Psací potřeba")).toBeInTheDocument();
  });

  it("sdílený zápis zachová tableEditable a sjednotí délku řádků", () => {
    const item = table({ tableRows: [["A"], ["Pevný text", ""]] });
    const patch = updateTableCellText(item, 0, 1, "B");
    expect(patch.tableRows).toEqual([["A", "B"], ["Pevný text", ""]]);
    expect(patch.tableEditable).toEqual([[false, false], [false, true]]);
    expect(item.tableRows).toEqual([["A"], ["Pevný text", ""]]);

    const emptyPatch = updateTableCellText(table({ tableRows: [], tableEditable: undefined }), 0, 1, "Druhý");
    expect(emptyPatch.tableRows?.[0]).toEqual(["Sloupec 1", "Druhý"]);
  });

  it("změna spec je atomická a body ani ostatní buňky nemění", () => {
    const item = table({ id: "table-1", points: 3 });
    const spec = emptyWorksheetSpec();
    spec.variants[0].items = [item];
    const next = applyWorksheetInlineTextEdit(spec, item.id, "tableRows.2.1", "Tužka");
    expect(next.variants[0].items[0]).toMatchObject({
      points: 3,
      tableRows: [["Pojem", "Význam"], ["Sešit", ""], ["Pero", "Tužka"]],
      tableEditable: [[false, false], [false, true], [false, false]],
    });
    expect(item.tableRows?.[2][1]).toBe("Psací potřeba");
  });

  it("formulář používá stejný zápis a převezme hodnotu z inline změny", () => {
    const update = vi.fn();
    const item = table({ id: "table-form" });
    const { rerender } = render(<TableFieldsEditor item={item} onUpdate={update} />);
    fireEvent.change(screen.getByDisplayValue("Psací potřeba"), { target: { value: "Tužka" } });
    expect(update).toHaveBeenCalledWith({
      tableRows: [["Pojem", "Význam"], ["Sešit", ""], ["Pero", "Tužka"]],
      tableEditable: [[false, false], [false, true], [false, false]],
    });

    const spec = emptyWorksheetSpec();
    spec.variants[0].items = [item];
    const next = applyWorksheetInlineTextEdit(spec, item.id, "tableRows.2.1", "Tužka");
    rerender(<TableFieldsEditor item={next.variants[0].items[0]} onUpdate={update} />);
    expect(screen.getByDisplayValue("Tužka")).toBeInTheDocument();
  });

  it("Esc v pevné buňce vrátí text bez zápisu", () => {
    const edit = vi.fn();
    render(<TableItem {...props} item={table()} onEditText={edit} />);
    const cell = screen.getByLabelText("Buňka řádek 3, sloupec 2");
    fireEvent.focus(cell);
    fireEvent.change(cell, { target: { value: "Omyl" } });
    fireEvent.keyDown(cell, { key: "Escape" });
    fireEvent.blur(cell);
    expect(cell).toHaveValue("Psací potřeba");
    expect(edit).not.toHaveBeenCalled();
  });
});

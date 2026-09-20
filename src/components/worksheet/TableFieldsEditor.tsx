/**
 * TableFieldsEditor — editace tabulkového bloku v editoru pracovního listu.
 *
 * Umožňuje přidat/smazat řádek i sloupec a upravit text v libovolné buňce.
 * Ve žákovském zobrazení (WorksheetPlayer) a v tisku zůstává tabulka read-only.
 */

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { WorksheetItem } from "@/lib/worksheet-spec";

const EMPTY: string[][] = [["Sloupec 1", "Sloupec 2"], ["", ""]];

export default function TableFieldsEditor({
  item,
  onUpdate,
}: {
  item: WorksheetItem;
  onUpdate: (patch: Partial<WorksheetItem>) => void;
}) {
  if (item.type !== "table") return null;

  const rows: string[][] = item.tableRows && item.tableRows.length > 0 ? item.tableRows : EMPTY;
  const colCount = Math.max(1, ...rows.map((r) => r.length));

  /** Zajistí, že všechny řádky mají stejný počet buněk. */
  const normalize = (next: string[][], cols = colCount) =>
    next.map((r) => {
      const copy = [...r];
      while (copy.length < cols) copy.push("");
      return copy.slice(0, cols);
    });

  const setRows = (next: string[][], cols = colCount) =>
    onUpdate({ tableRows: normalize(next, cols) });

  const setCell = (ri: number, ci: number, value: string) => {
    const next = rows.map((r) => [...r]);
    next[ri][ci] = value;
    setRows(next);
  };

  const addRow = () => setRows([...rows, Array(colCount).fill("")]);
  const removeRow = (ri: number) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== ri));
  };
  const addColumn = () =>
    setRows(
      rows.map((r, ri) => [...r, ri === 0 ? `Sloupec ${colCount + 1}` : ""]),
      colCount + 1,
    );
  const removeColumn = (ci: number) => {
    if (colCount <= 1) return;
    setRows(
      rows.map((r) => r.filter((_, i) => i !== ci)),
      colCount - 1,
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs">Tabulka (první řádek je hlavička)</Label>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Řádek
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={addColumn}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Sloupec
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {Array.from({ length: colCount }).map((_, ci) => (
                <th key={ci} className="align-bottom">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    aria-label={`Smazat sloupec ${ci + 1}`}
                    onClick={() => removeColumn(ci)}
                    disabled={colCount <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground"
                    aria-label={`Smazat řádek ${ri + 1}`}
                    onClick={() => removeRow(ri)}
                    disabled={rows.length <= 1}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </td>
                {Array.from({ length: colCount }).map((_, ci) => (
                  <td key={ci}>
                    <Input
                      value={row[ci] ?? ""}
                      onChange={(e) => setCell(ri, ci, e.target.value)}
                      className={`h-8 min-w-[140px] text-sm ${ri === 0 ? "font-semibold" : ""}`}
                      placeholder={ri === 0 ? `Sloupec ${ci + 1}` : ""}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <Label className="text-xs">Popisek tabulky (volitelné)</Label>
        <Input
          value={item.tableCaption ?? ""}
          onChange={(e) => onUpdate({ tableCaption: e.target.value })}
          placeholder="Např. Zdroj: lekce"
        />
      </div>
    </div>
  );
}

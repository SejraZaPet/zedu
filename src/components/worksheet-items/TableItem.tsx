/**
 * TableItem — Read-only renderer pro typ "table".
 *
 * Tabulka převzatá 1:1 z lekce. Žák do ní nic nezapisuje (v online verzi),
 * slouží jako podklad k dalším úlohám. `value` se nepoužívá, `onChange` se nevolá.
 */

import type { WorksheetItemProps } from "./types";

export default function TableItem({ item }: WorksheetItemProps) {
  const rows = item.tableRows ?? [];
  if (rows.length === 0) return null;
  const [head, ...rest] = rows;

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50">
              {head.map((cell, i) => (
                <th key={i} className="border border-border px-3 py-2 text-left font-semibold text-foreground">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rest.map((row, ri) => (
              <tr key={ri}>
                {row.map((cell, ci) => (
                  <td key={ci} className="border border-border px-3 py-2 align-top text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {item.tableCaption && (
        <p className="text-xs text-muted-foreground">{item.tableCaption}</p>
      )}
    </div>
  );
}

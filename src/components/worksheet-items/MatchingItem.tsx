import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { shuffleNonIdentity } from "@/lib/shuffle";
import type { WorksheetItemProps } from "./types";

/** Neprázdné, unikátní pravé strany – Radix SelectItem nesmí mít prázdnou hodnotu. */
export function matchingOptions(pairs: ReadonlyArray<{ left?: string | null; right?: string | null } | null | undefined>): string[] {
  const out: string[] = [];
  for (const p of pairs) {
    const r = (p?.right ?? "").trim();
    if (r && !out.includes(r)) out.push(r);
  }
  return out;
}

/** Páry pro zobrazení žákovi / tisk: vynechá páry s prázdnou stranou (specifikace se nemění). */
export function displayableMatchPairs<T extends { left?: string | null; right?: string | null }>(pairs: ReadonlyArray<T | null | undefined> | undefined): T[] {
  return (pairs ?? []).filter((p): p is T => !!p && !!(p.left ?? "").trim() && !!(p.right ?? "").trim());
}

export default function MatchingItem({ item, value, onChange, disabled }: WorksheetItemProps) {
  const pairs = (item.matchPairs ?? []).map((p) => ({ left: p?.left ?? "", right: p?.right ?? "" }));
  const optionsKey = matchingOptions(pairs).join("|");
  // Nabídka odpovědí se zamíchá při každém zobrazení – nikdy nesmí být
  // ve stejném pořadí jako levý sloupec (to by prozradilo správné páry).
  const rights = useMemo(
    () => shuffleNonIdentity(optionsKey ? optionsKey.split("|") : []),
    [optionsKey],
  );
  const currentAnswers: string[] = Array.isArray(value) ? value : Array(pairs.length).fill("");

  return (
    <div className="space-y-3">
      {pairs.map((pair, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-sm font-medium min-w-[120px]">{pair.left}</span>
          <span className="text-muted-foreground">→</span>
          {rights.length === 0 ? (
            <span className="text-sm text-muted-foreground italic">Doplňte pravou stranu</span>
          ) : (
            <Select
              value={rights.includes(currentAnswers[i]) ? currentAnswers[i] : undefined}
              onValueChange={(v) => {
                const next = [...currentAnswers];
                next[i] = v;
                onChange(next);
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Vyberte…" />
              </SelectTrigger>
              <SelectContent>
                {rights.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ))}
    </div>
  );
}

import type { WorksheetItem } from "@/lib/worksheet-spec";

/** Psací bloky bez bodů (linky, prázdné místo, dvě okna) jsou prostor k zápisu, ne otázka. */
const ZERO_POINT_WRITING_BLOCKS = new Set(["write_lines", "blank_box", "two_boxes"]);

/** Započítává se položka do „Vyplněno x/y“? (Jen skutečné otázky.) */
export function countsTowardProgress(item: WorksheetItem): boolean {
  return !(ZERO_POINT_WRITING_BLOCKS.has(item.type) && !(item.points > 0));
}

/** Položky pro ukazatel postupu; když by nezbyla žádná, počítají se všechny. */
export function progressItems(items: WorksheetItem[]): WorksheetItem[] {
  const counted = items.filter(countsTowardProgress);
  return counted.length > 0 ? counted : items;
}

/** Štítek bodů — u nulových bodů se nezobrazuje. */
export function pointsBadgeLabel(n: number): string | null {
  if (!(n > 0)) return null;
  return `${n} ${n === 1 ? "bod" : n >= 2 && n <= 4 ? "body" : "bodů"}`;
}

import type { AnswerKeyEntry, WorksheetItem, WorksheetSpec } from "@/lib/worksheet-spec";
import { updateTableCellText } from "@/lib/worksheet-table";

/** Cesty prostých textů, které editor umí změnit přímo v listu. */
export type WorksheetInlineTextPath =
  | "prompt"
  | "imageText"
  | "calloutTitle"
  | "calloutText"
  | `choices.${number}`
  | `flowSteps.${number}`
  | `tableRows.${number}.${number}`;

const DIRECT_FIELDS = new Set(["prompt", "imageText", "calloutTitle", "calloutText"]);
const INDEXED_PATH = /^(choices|flowSteps)\.(\d+)$/;
const TABLE_CELL_PATH = /^tableRows\.(\d+)\.(\d+)$/;

/** Textová pole se mění stejně jako ve formuláři; struktura ani bodování se nemění. */
export function worksheetInlineTextPatch(
  item: WorksheetItem,
  path: WorksheetInlineTextPath,
  value: string,
): Partial<WorksheetItem> {
  if (DIRECT_FIELDS.has(path)) return { [path]: value };

  const tableMatch = TABLE_CELL_PATH.exec(path);
  if (item.type === "table" && tableMatch) {
    return updateTableCellText(item, Number(tableMatch[1]), Number(tableMatch[2]), value);
  }

  const match = INDEXED_PATH.exec(path);
  if (!match) return {};
  const field = match[1] as "choices" | "flowSteps";
  const index = Number(match[2]);
  const current = item[field] ?? [];
  if (!Number.isInteger(index) || index < 0 || index >= current.length) return {};
  const next = [...current];
  next[index] = value;
  return { [field]: next };
}

/**
 * Jedna atomická změna specifikace = jeden krok zpět. Při přejmenování správné
 * možnosti ABCD se ve stejném kroku přenese text jejího klíče jako ve formuláři.
 */
export function applyWorksheetInlineTextEdit(
  spec: WorksheetSpec,
  itemId: string,
  path: WorksheetInlineTextPath,
  value: string,
): WorksheetSpec {
  const variant = spec.variants[0];
  const item = variant?.items.find((entry) => entry.id === itemId);
  if (!variant || !item) return spec;

  const itemPatch = worksheetInlineTextPatch(item, path, value);
  let answerKeyPatch: Partial<AnswerKeyEntry> | undefined;
  const choiceMatch = /^choices\.(\d+)$/.exec(path);
  if (item.type === "mcq" && choiceMatch) {
    const oldChoice = item.choices?.[Number(choiceMatch[1])];
    const key = (spec.answerKeys[variant.variantId] ?? []).find((entry) => entry.itemId === itemId);
    if (key?.correctAnswer === oldChoice) answerKeyPatch = { correctAnswer: value };
  }

  return {
    ...spec,
    variants: spec.variants.map((entry, index) => index === 0
      ? { ...entry, items: entry.items.map((current) => current.id === itemId ? { ...current, ...itemPatch } : current) }
      : entry),
    answerKeys: answerKeyPatch
      ? {
          ...spec.answerKeys,
          [variant.variantId]: (spec.answerKeys[variant.variantId] ?? []).map((entry) =>
            entry.itemId === itemId ? { ...entry, ...answerKeyPatch } : entry),
        }
      : spec.answerKeys,
  };
}

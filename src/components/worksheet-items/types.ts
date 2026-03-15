/**
 * Shared props contract for all worksheet item renderers.
 *
 * Every item component receives the same props shape,
 * making them independently testable and swappable.
 */

import type { WorksheetItem, AnswerKeyEntry } from "@/lib/worksheet-spec";

/** The answer value stored per item — string, string[], or undefined */
export type ItemAnswer = string | string[] | undefined;

export interface WorksheetItemProps {
  /** The worksheet item definition */
  item: WorksheetItem;
  /** Current answer value */
  value: ItemAnswer;
  /** Callback to update answer */
  onChange: (value: ItemAnswer) => void;
  /** Whether input is disabled (submitted/locked) */
  disabled: boolean;
  /** Whether to show correct/incorrect feedback */
  showResults: boolean;
  /** The correct answer entry (only used when showResults=true) */
  answerKeyEntry?: AnswerKeyEntry;
}

import type { WorksheetItem } from "@/lib/worksheet-spec";

export const WRITE_LINE_MIN = 1;
export const WRITE_LINE_MAX = 20;
export const WRITE_LINE_HEIGHT_MM = 7.5;

export function getWriteLineCount(item: Pick<WorksheetItem, "lineCount" | "answerSpace">): number {
  const stored = item.lineCount ?? item.answerSpace.lineCount ?? 3;
  return Math.max(WRITE_LINE_MIN, Math.min(WRITE_LINE_MAX, Math.round(stored)));
}

export function createWriteLinePatch(
  item: Pick<WorksheetItem, "answerSpace">,
  requestedCount: number,
): Pick<WorksheetItem, "lineCount" | "answerSpace"> {
  const count = Math.max(
    WRITE_LINE_MIN,
    Math.min(WRITE_LINE_MAX, Math.round(Number.isFinite(requestedCount) ? requestedCount : WRITE_LINE_MIN)),
  );

  return {
    lineCount: count,
    answerSpace: {
      ...item.answerSpace,
      type: "lines",
      lineCount: count,
      heightMm: count * WRITE_LINE_HEIGHT_MM,
    },
  };
}

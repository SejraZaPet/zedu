import type { AnswerSpace, WorksheetItem } from "@/lib/worksheet-spec";

export const WRITE_LINE_MIN = 1;
export const WRITE_LINE_MAX = 20;
/** Jediná sdílená výška řádku pro psaní (tisk, editor, model). */
export const WRITE_LINE_HEIGHT_MM = 8.5;
export const WRITE_LINE_HEIGHT_MIN_MM = 7;
export const WRITE_LINE_HEIGHT_MAX_MM = 12;

/** Výška řádku položky (`lineHeightMm` 7–12, jinak výchozí 8,5 mm). */
export function getWriteLineHeightMm(item?: Pick<WorksheetItem, "lineHeightMm"> | null): number {
  const raw = Number(item?.lineHeightMm);
  if (!Number.isFinite(raw) || raw <= 0) return WRITE_LINE_HEIGHT_MM;
  return Math.max(WRITE_LINE_HEIGHT_MIN_MM, Math.min(WRITE_LINE_HEIGHT_MAX_MM, raw));
}

export function getWriteLineCount(item: Pick<WorksheetItem, "lineCount" | "answerSpace">): number {
  const stored = item.lineCount ?? item.answerSpace.lineCount ?? 3;
  return Math.max(WRITE_LINE_MIN, Math.min(WRITE_LINE_MAX, Math.round(stored)));
}

/**
 * Výška místa pro odpověď v mm. U `lines` se odvozuje z počtu řádků
 * (ne z uloženého `heightMm`), aby se řádky neřezaly.
 */
export function answerSpaceHeightMm(space: AnswerSpace): number {
  if (space.type === "none") return 0;
  if (space.type === "lines") {
    const count = space.lineCount && space.lineCount > 0
      ? space.lineCount
      : Math.max(2, Math.floor((space.heightMm || 0) / 8));
    return count * WRITE_LINE_HEIGHT_MM;
  }
  return space.heightMm;
}

export function answerSpaceLineCount(space: AnswerSpace): number {
  return space.lineCount && space.lineCount > 0 ? space.lineCount : Math.max(2, Math.floor((space.heightMm || 0) / 8));
}

export function createWriteLinePatch(
  item: Pick<WorksheetItem, "answerSpace"> & Partial<Pick<WorksheetItem, "lineHeightMm">>,
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
      heightMm: count * getWriteLineHeightMm(item),
    },
  };
}

// ─── Prázdné místo (blank_box) ───
export const BLANK_BOX_DEFAULT_MM = 40;
export const BLANK_BOX_MIN_MM = 10;
export const BLANK_BOX_MAX_MM = 200;

export function getBlankBoxHeightMm(item: Pick<WorksheetItem, "blankHeightMm">): number {
  const raw = Number(item.blankHeightMm);
  if (!Number.isFinite(raw) || raw <= 0) return BLANK_BOX_DEFAULT_MM;
  return Math.max(BLANK_BOX_MIN_MM, Math.min(BLANK_BOX_MAX_MM, Math.round(raw)));
}

/** CSS pozadí pro styl prázdného místa (sdílené tiskem i editorem). */
export function blankBoxBackgroundCss(style: string | undefined, lineMm = WRITE_LINE_HEIGHT_MM): string {
  const c = "#CBD5E1";
  switch (style) {
    case "lines":
      return `background-image:linear-gradient(to bottom, transparent calc(${lineMm}mm - 0.7pt), ${c} calc(${lineMm}mm - 0.7pt));background-size:100% ${lineMm}mm;`;
    case "grid":
      return `background-image:linear-gradient(${c} 0.5pt, transparent 0.5pt),linear-gradient(90deg, ${c} 0.5pt, transparent 0.5pt);background-size:5mm 5mm;`;
    case "dots":
      return `background-image:radial-gradient(${c} 0.8pt, transparent 0.9pt);background-size:5mm 5mm;`;
    default:
      return "";
  }
}

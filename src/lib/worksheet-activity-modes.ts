/** Co se má s aktivitou z lekce stát při AI generování listu. */
export type LessonActivityMode = "qr" | "convert" | "none";

interface ActivityLike { id: string; deepLinkIndex?: number }

/** Výchozí volba: QR kód, pokud má aktivita vlastní odkaz, jinak převod na úlohu. */
export const defaultActivityMode = (a: ActivityLike): LessonActivityMode =>
  a.deepLinkIndex !== undefined ? "qr" : "convert";

/** Rozdělí aktivity na QR kódy a úlohy k převodu; „none“ vynechá úplně. */
export function splitLessonActivities<T extends ActivityLike>(
  activities: T[],
  modes: Record<string, LessonActivityMode | undefined>,
): { qr: T[]; convert: T[]; skipped: T[] } {
  const qr: T[] = [], convert: T[] = [], skipped: T[] = [];
  for (const a of activities) {
    const m = modes[a.id] ?? "qr";
    if (m === "none") skipped.push(a);
    else if (m !== "convert" && a.deepLinkIndex !== undefined) qr.push(a);
    else convert.push(a);
  }
  return { qr, convert, skipped };
}

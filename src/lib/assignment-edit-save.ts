/**
 * Logika ukládání editované úlohy: u už publikované úlohy nesmí úprava
 * změnit status (žádné stažení do konceptu, žádné nové notifikace).
 */

export type SaveMode = "draft" | "scheduled" | "published";

/** Už publikovaná úloha při editaci: místo tří tlačítek jen "Uložit změny". */
export const showSaveChangesOnly = (originalStatus?: string | null): boolean =>
  originalStatus === "published";

/**
 * Výsledný status a titulek toastu při ukládání editované úlohy.
 * `status: undefined` znamená, že se do patche status vůbec nedá
 * (už publikovaná úloha zůstává published beze změny).
 */
export function editSaveOutcome(
  originalStatus: string | null | undefined,
  mode: SaveMode,
): { status?: string; toastTitle: string } {
  if (mode === "published") {
    return showSaveChangesOnly(originalStatus)
      ? { status: undefined, toastTitle: "Změny uloženy" }
      : { status: "published", toastTitle: "Úloha publikována" };
  }
  if (mode === "scheduled") {
    return showSaveChangesOnly(originalStatus)
      ? { status: undefined, toastTitle: "Úloha naplánována" }
      : { status: "scheduled", toastTitle: "Úloha naplánována" };
  }
  return { status: "draft", toastTitle: "Koncept uložen" };
}

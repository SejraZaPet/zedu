/** Pravidla pro položku „Publikovat bez zadání (jen do materiálů)“ v editoru listu. */
export type WorksheetPublishStatus = "draft" | "published" | "scheduled" | string;

export const PUBLISH_MATERIALS_ONLY_LABEL = "Publikovat bez zadání (jen do materiálů)";
export const PUBLISH_MATERIALS_ONLY_HINT = "List bude dostupný k přidání do materiálů, třídě se nezobrazí.";
export const PUBLISH_MATERIALS_ONLY_TOAST = "Publikováno do materiálů – žákům nebylo nic zadáno";

/** Nabízí se jen u konceptu; publikovaný i naplánovaný list zůstávají beze změny. */
export function canPublishToMaterialsOnly(status: WorksheetPublishStatus): boolean {
  return status === "draft";
}

/** Změna řádku worksheets: jen stav, žádný úkol, třída ani příjemci. */
export function materialsOnlyPublishPatch() {
  return { status: "published" as const, scheduled_publish_at: null };
}

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

export const PUBLISH_MATERIALS_ONLY_BLOCKED =
  "Bez zadání nelze publikovat: list je propojený s lekcí nebo plánem hodiny a žáci by ho po publikaci viděli.";

export type MaterialsOnlyBlockReason = "not_draft" | "in_lesson" | "in_plan" | "in_lesson_and_plan" | "unknown";

export interface MaterialsOnlyInput {
  status: WorksheetPublishStatus;
  show_in_lesson: boolean | null | undefined;
  source_lesson_id: string | null | undefined;
  /** true/false z čtecího dotazu; null = dotaz selhal nebo ještě neproběhl. */
  inVisiblePlan: boolean | null;
}

/**
 * Zrcadlí DB funkce can_student_view_worksheet_in_lesson (show_in_lesson + source_lesson_id)
 * a is_worksheet_in_student_lesson_plan (viditelný plán s listem nebo jeho lekcí).
 * Neznámý stav plánu = nenabízet.
 */
export function materialsOnlyDecision(i: MaterialsOnlyInput): { allowed: boolean; reason: MaterialsOnlyBlockReason | null } {
  if (!canPublishToMaterialsOnly(i.status)) return { allowed: false, reason: "not_draft" };
  const inLesson = i.show_in_lesson === true && !!i.source_lesson_id;
  if (inLesson && i.inVisiblePlan === true) return { allowed: false, reason: "in_lesson_and_plan" };
  if (inLesson) return { allowed: false, reason: "in_lesson" };
  if (i.inVisiblePlan === true) return { allowed: false, reason: "in_plan" };
  if (i.inVisiblePlan !== false) return { allowed: false, reason: "unknown" };
  return { allowed: true, reason: null };
}

export function materialsOnlyReasonLabel(reason: MaterialsOnlyBlockReason | null): string | null {
  switch (reason) {
    case "in_lesson": return "Platí: zobrazuje se v lekci.";
    case "in_plan": return "Platí: je v plánu hodiny viditelném žákům.";
    case "in_lesson_and_plan": return "Platí: zobrazuje se v lekci i v plánu hodiny.";
    case "unknown": return "Propojení s plánem hodiny se nepodařilo ověřit.";
    default: return null;
  }
}

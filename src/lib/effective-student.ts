/**
 * Režim „Prohlížíš jako Žák": systémový admin vidí data pevně daného
 * ukázkového žáka (sdílený demo „spolužák"), pouze ke čtení.
 * Klientská tabulka demo_shared_users není čitelná (RLS bez politik),
 * proto je ID uvedeno zde; jde o sdílený demo účet, ne skutečného žáka.
 */
export const PREVIEW_DEMO_STUDENT_ID = "b0b6bdf8-7de5-453f-9492-499a54665ebf";

export interface EffectiveStudent {
  studentId: string | null;
  isPreview: boolean;
}

export function resolveEffectiveStudent(
  userId: string | null | undefined,
  realRole: string | null | undefined,
  viewAsRole: string | null | undefined,
): EffectiveStudent {
  if (realRole === "admin" && viewAsRole === "user") {
    return { studentId: PREVIEW_DEMO_STUDENT_ID, isPreview: true };
  }
  return { studentId: userId ?? null, isPreview: false };
}

export const PREVIEW_WRITE_MESSAGE = "Toto je náhled – změny se neukládají.";

/** Vrátí true a ohlásí, pokud je zápis v náhledu zakázán. */
export function blockPreviewWrite(isPreview: boolean, notify?: (msg: string) => void): boolean {
  if (!isPreview) return false;
  notify?.(PREVIEW_WRITE_MESSAGE);
  return true;
}

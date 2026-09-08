/**
 * Jediný zdroj pravdy pro barvu a zkratku předmětu v celé aplikaci.
 *
 * Pravidlo priorit (platí všude, kde existuje konkrétní hodina):
 *   1. barva/zkratka nastavená u konkrétní hodiny (`class_schedule_slots.color`)
 *   2. barva/zkratka z katalogu předmětů (`subjects.color` / `subjects.abbreviation`)
 *   3. barva odvozená deterministicky z názvu / prvních 3 znaků názvu
 *
 * Katalogové přehledy bez kontextu hodiny předávají `slot = null`.
 */

/** Předvolená paleta pro výběr barvy předmětu. */
export const SUBJECT_COLORS: { value: string; label: string }[] = [
  { value: "#6EC6D9", label: "Tyrkysová" },
  { value: "#9B6CFF", label: "Fialová" },
  { value: "#F472B6", label: "Růžová" },
  { value: "#F87171", label: "Červená" },
  { value: "#FB923C", label: "Oranžová" },
  { value: "#FBBF24", label: "Žlutá" },
  { value: "#34D399", label: "Zelená" },
  { value: "#60A5FA", label: "Modrá" },
  { value: "#A3A3A3", label: "Šedá" },
];

/**
 * Stabilní barva odvozená z názvu předmětu (deterministicky).
 * Jediná implementace v celé aplikaci – dřív existovaly tři kopie.
 */
export function colorForSubject(subject: string): string {
  if (!subject) return SUBJECT_COLORS[0].value;
  let hash = 0;
  for (let i = 0; i < subject.length; i++) hash = (hash * 31 + subject.charCodeAt(i)) >>> 0;
  return SUBJECT_COLORS[hash % SUBJECT_COLORS.length].value;
}

/** Vzhled uložený u konkrétní hodiny / lekce v rozvrhu. */
export interface SubjectAppearanceSlot {
  color?: string | null;
  abbreviation?: string | null;
  subject_label?: string | null;
}

/** Vzhled z kanonického katalogu `subjects`. */
export interface SubjectAppearanceCanonical {
  name?: string | null;
  color?: string | null;
  abbreviation?: string | null;
}

/** Název předmětu: katalog > text u hodiny > fallback. */
export function getSubjectName(
  slot?: SubjectAppearanceSlot | null,
  canonical?: SubjectAppearanceCanonical | null,
  fallback = "Hodina",
): string {
  return (
    canonical?.name?.trim() || slot?.subject_label?.trim() || fallback
  );
}

/** Barva: hodina > katalog > odvozená z názvu. */
export function getSubjectColor(
  slot?: SubjectAppearanceSlot | null,
  canonical?: SubjectAppearanceCanonical | null,
  nameOverride?: string,
): string {
  const name = nameOverride ?? getSubjectName(slot, canonical, "");
  return slot?.color || canonical?.color || colorForSubject(name);
}

/** Zkratka: hodina > katalog > první 3 znaky názvu. */
export function getSubjectAbbreviation(
  slot?: SubjectAppearanceSlot | null,
  canonical?: SubjectAppearanceCanonical | null,
  nameOverride?: string,
): string {
  const name = nameOverride ?? getSubjectName(slot, canonical, "");
  const raw =
    slot?.abbreviation?.trim() ||
    canonical?.abbreviation?.trim() ||
    name.slice(0, 3);
  return raw.toUpperCase();
}

export interface PlacementConflictInput {
  topic_id: string;
  class_id?: string | null;
  subject_group_id?: string | null;
  school_term?: "full_year" | "first_half" | "second_half" | null;
  target_type?: "grade" | "class" | "group" | null;
}

const audienceOf = (p: PlacementConflictInput) =>
  p.target_type ?? (p.class_id ? "class" : p.subject_group_id ? "group" : "grade");

const termsOverlap = (a?: string | null, b?: string | null) => {
  const ta = a || "full_year";
  const tb = b || "full_year";
  return ta === "full_year" || tb === "full_year" || ta === tb;
};

/** Kolize = stejné téma, stejný příjemce (typ + třída/skupina) a překrývající se období. */
export const placementsConflict = (a: PlacementConflictInput, b: PlacementConflictInput): boolean => {
  if (!a.topic_id || a.topic_id !== b.topic_id) return false;
  const aud = audienceOf(a);
  if (aud !== audienceOf(b)) return false;
  if (aud === "class" && (a.class_id ?? null) !== (b.class_id ?? null)) return false;
  if (aud === "group" && (a.subject_group_id ?? null) !== (b.subject_group_id ?? null)) return false;
  return termsOverlap(a.school_term, b.school_term);
};

export const hasPlacementConflict = (all: PlacementConflictInput[], index: number): boolean =>
  all.some((other, i) => i !== index && placementsConflict(all[index], other));

export const PLACEMENT_CONFLICT_HINT =
  "Stejné téma je už přiřazeno stejnému příjemci ve stejném období.";

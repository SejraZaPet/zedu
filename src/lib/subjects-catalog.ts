import { supabase } from "@/integrations/supabase/client";
import { DEFAULT_SUBJECT_COLOR } from "@/lib/subject-defaults";

/**
 * Canonical subject entity (table `subjects`).
 *
 * `subjects` is from now on the ONLY place where new subjects are created.
 * The legacy catalog `textbook_subjects` stays untouched (read-only fallback),
 * and legacy free-text columns (`teacher_textbooks.subject`,
 * `worksheets.subject`, `class_schedule_slots.subject_label`, …) keep being
 * written in parallel (dual write) so that everything reading only text
 * continues to work.
 */
export interface SubjectCatalogItem {
  id: string;
  name: string;
  color: string;
  abbreviation: string | null;
  school_id: string | null;
  created_by: string | null;
  /** Archived subjects stay in the database but are hidden from new links. */
  archived: boolean;
}

export const SUBJECT_CATALOG_QUERY_KEY = ["subjects-catalog"] as const;

const CATALOG_COLUMNS = "id, name, color, abbreviation, school_id, created_by, archived";

export const fetchSubjectCatalog = async (): Promise<SubjectCatalogItem[]> => {
  const { data, error } = await supabase
    .from("subjects")
    .select(CATALOG_COLUMNS)
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as SubjectCatalogItem[];
};

const norm = (v: string) => v.trim().toLowerCase();

export const findSubjectByName = (
  catalog: SubjectCatalogItem[],
  name: string | null | undefined,
): SubjectCatalogItem | undefined => {
  if (!name) return undefined;
  return catalog.find((s) => norm(s.name) === norm(name));
};

/** Escapes PostgREST `ilike` wildcards so names with % or _ match literally. */
const escapeLike = (v: string) => v.replace(/[%_]/g, (m) => `\\${m}`);

/**
 * Creates a subject in `subjects`, or returns the existing one when a subject
 * with the same (case-insensitive) name already exists.
 */
export const createSubject = async (input: {
  name: string;
  color?: string;
  abbreviation?: string | null;
  school_id?: string | null;
}): Promise<SubjectCatalogItem> => {
  const name = input.name.trim();
  if (!name) throw new Error("Název předmětu nesmí být prázdný.");

  const { data: existing } = await supabase
    .from("subjects")
    .select(CATALOG_COLUMNS)
    .ilike("name", escapeLike(name))
    .limit(1)
    .maybeSingle();
  if (existing) {
    const found = existing as SubjectCatalogItem;
    // Re-creating a subject that was archived means the teacher wants it back.
    if (found.archived) {
      const { data: revived } = await supabase
        .from("subjects")
        .update({ archived: false })
        .eq("id", found.id)
        .select(CATALOG_COLUMNS)
        .maybeSingle();
      if (revived) return revived as SubjectCatalogItem;
    }
    return found;
  }

  // The row must carry the current user's id — the RLS policy requires
  // `created_by = auth.uid()`. Reading the user directly (instead of a possibly
  // stale cached session) prevents inserts with `created_by: null`, which the
  // database rejects.
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    throw new Error("Pro založení předmětu musíte být přihlášeni. Přihlaste se prosím znovu.");
  }

  const { data, error } = await supabase
    .from("subjects")
    .insert({
      name,
      color: input.color ?? DEFAULT_SUBJECT_COLOR,
      abbreviation: input.abbreviation ?? null,
      school_id: input.school_id ?? null,
      created_by: userId,
    })
    .select(CATALOG_COLUMNS)
    .single();
  if (error) {
    if (error.code === "42501") {
      throw new Error(
        "Nemáte oprávnění zakládat předměty. Předmět může vytvořit administrátor, lektor nebo učitel.",
      );
    }
    throw new Error(error.message || "Předmět se nepodařilo vytvořit.");
  }
  return data as SubjectCatalogItem;
};


/**
 * Resolves a subject selection to the pair we persist everywhere:
 * `{ subject_id, name }`. Accepts either an id (preferred) or a plain text
 * label typed by the user — in the latter case the subject is created on the
 * fly so no data path ends up without a canonical row.
 */
export const resolveSubjectSelection = async (
  catalog: SubjectCatalogItem[],
  selection: { id?: string | null; name?: string | null },
): Promise<{ subject_id: string | null; name: string }> => {
  if (selection.id) {
    const hit = catalog.find((s) => s.id === selection.id);
    if (hit) return { subject_id: hit.id, name: hit.name };
  }
  const label = (selection.name ?? "").trim();
  if (!label) return { subject_id: null, name: "" };
  const known = findSubjectByName(catalog, label);
  if (known) return { subject_id: known.id, name: known.name };
  const created = await createSubject({ name: label });
  return { subject_id: created.id, name: created.name };
};

const rlsError = (message?: string) =>
  new Error(
    message ||
      "Předmět může upravovat nebo mazat jen jeho autor, případně administrátor.",
  );

/** Archives (or restores) a subject — the row itself is never touched otherwise. */
export const setSubjectArchived = async (id: string, archived: boolean): Promise<void> => {
  const { data, error } = await supabase
    .from("subjects")
    .update({ archived })
    .eq("id", id)
    .select("id");
  if (error) throw rlsError(error.code === "42501" ? undefined : error.message);
  if (!data || data.length === 0) throw rlsError();
};

/**
 * Number of rows that would be cascade-deleted with the subject. Deleting is
 * only offered when both counts are zero, so group/class history can never be
 * wiped by accident.
 */
export const fetchSubjectDependencies = async (
  subjectIds: string[],
): Promise<Record<string, { groups: number; classSubjects: number }>> => {
  const result: Record<string, { groups: number; classSubjects: number }> = {};
  for (const id of subjectIds) result[id] = { groups: 0, classSubjects: 0 };
  if (subjectIds.length === 0) return result;

  // Counted server-side (SECURITY DEFINER) so rows owned by other teachers are
  // included — client-side selects would be hidden by RLS and under-count.
  const { data, error } = await supabase.rpc("subject_dependency_counts", {
    _subject_ids: subjectIds,
  });
  if (error) throw error;

  for (const row of (data ?? []) as {
    subject_id: string;
    group_count: number;
    class_subject_count: number;
  }[]) {
    result[row.subject_id] = {
      groups: Number(row.group_count) || 0,
      classSubjects: Number(row.class_subject_count) || 0,
    };
  }
  return result;
};

/** Hard delete — callers must verify there are no dependencies first. */
export const deleteSubject = async (id: string): Promise<void> => {
  const { data, error } = await supabase
    .from("subjects")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw rlsError(error.code === "42501" ? undefined : error.message);
  if (!data || data.length === 0) throw rlsError();
};

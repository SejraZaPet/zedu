import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects } from "./useSubjects";
import { PREDEFINED_SUBJECTS } from "@/lib/predefined-subjects";

/**
 * A subject available to a teacher across the app.
 * Sources, in priority order:
 *  1. Teacher's own teacher_textbooks (each unique subject becomes an entry)
 *  2. Global textbook_subjects (active)
 *  3. PREDEFINED_SUBJECTS list (canonical names with no DB row)
 *
 * The same `label` from any source is deduplicated (case-insensitive).
 */
export interface TeacherSubject {
  /** Display label (e.g. "Matematika") — always non-empty */
  label: string;
  /** Optional short code (MAT, ČJ…) coming from textbook_subjects */
  abbreviation?: string;
  /** Optional brand color from textbook_subjects */
  color?: string;
  /** Slug from textbook_subjects (if backed by one) */
  slug?: string;
  /** Where this subject originated */
  source: "teacher_textbook" | "global_subject" | "predefined";
  /** Linkable textbook id (only for `teacher_textbook` source) */
  teacherTextbookId?: string;
}

/**
 * Returns the unified list of subjects the teacher can pick from
 * (their own textbooks + global subjects + predefined fallbacks).
 *
 * Use this everywhere a teacher needs to "choose a subject" so the same
 * source of truth drives the schedule, class scheduling and lesson editor.
 */
export const useTeacherSubjects = () => {
  const { data: globalSubjects = [], isLoading: loadingGlobal } = useSubjects(true);

  const { data: teacherTextbooks = [], isLoading: loadingTeacher } = useQuery({
    queryKey: ["teacher-textbooks-for-subjects"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from("teacher_textbooks")
        .select("id, title, subject")
        .eq("teacher_id", session.user.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60 * 1000,
  });

  const seen = new Map<string, TeacherSubject>();

  // 1. Teacher's own textbooks — title is the user-facing subject name
  for (const tb of teacherTextbooks) {
    const label = (tb.title || "").trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    // Try to enrich with metadata from a matching global subject (by slug)
    const matchedGlobal = globalSubjects.find((g) => g.slug === tb.subject);
    seen.set(key, {
      label,
      abbreviation: matchedGlobal?.abbreviation,
      color: matchedGlobal?.color,
      slug: tb.subject || matchedGlobal?.slug,
      source: "teacher_textbook",
      teacherTextbookId: tb.id,
    });
  }

  // 2. Global subjects
  for (const g of globalSubjects) {
    const key = g.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, {
      label: g.label,
      abbreviation: g.abbreviation,
      color: g.color,
      slug: g.slug,
      source: "global_subject",
    });
  }

  // 3. Predefined fallbacks
  for (const name of PREDEFINED_SUBJECTS) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.set(key, { label: name, source: "predefined" });
  }

  const subjects = Array.from(seen.values()).sort((a, b) => {
    // Teacher textbooks first, then global, then predefined; alpha within each group
    const order = { teacher_textbook: 0, global_subject: 1, predefined: 2 } as const;
    if (order[a.source] !== order[b.source]) return order[a.source] - order[b.source];
    return a.label.localeCompare(b.label, "cs");
  });

  return {
    subjects,
    loading: loadingGlobal || loadingTeacher,
  };
};

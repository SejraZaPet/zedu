import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSubjects } from "./useSubjects";
import { useSubjectCatalog } from "./useSubjectCatalog";
import { PREDEFINED_SUBJECTS } from "@/lib/predefined-subjects";
import { useAuth } from "@/contexts/AuthContext";

/**
 * A subject available to a teacher across the app.
 *
 * Primary source is now the canonical `subjects` catalog. The legacy sources
 * are kept purely as a backward-compatible fallback so that older rows
 * (teacher textbooks with a free-text subject, the legacy `textbook_subjects`
 * catalog and the static predefined list) never disappear from pickers.
 *
 * The same `label` from any source is deduplicated (case-insensitive).
 */
export interface TeacherSubject {
  /** Canonical `subjects.id` when this subject exists in the new catalog */
  id?: string;
  /** Display label (e.g. "Matematika") — always non-empty */
  label: string;
  /** Optional short code (MAT, ČJ…) */
  abbreviation?: string;
  /** Optional brand color */
  color?: string;
  /** Slug from textbook_subjects (if backed by one) */
  slug?: string;
  /** Where this subject originated */
  source: "subject" | "teacher_textbook" | "global_subject" | "predefined";
  /** Linkable textbook id (only for `teacher_textbook` source) */
  teacherTextbookId?: string;
}

/**
 * Returns the unified list of subjects the teacher can pick from
 * (canonical catalog first, then legacy fallbacks).
 */
export const useTeacherSubjects = () => {
  const { user, loading: authLoading } = useAuth();
  const { subjects: catalog, loading: loadingCatalog } = useSubjectCatalog();
  const { data: globalSubjects = [], isLoading: loadingGlobal } = useSubjects(true);

  const { data: teacherTextbooks = [], isLoading: loadingTeacher } = useQuery({
    queryKey: ["teacher-textbooks-for-subjects", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_textbooks")
        .select("id, title, subject, subject_id")
        .eq("teacher_id", user!.id)
        .is("deleted_at", null)
        .order("title", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !authLoading && !!user,
    staleTime: 60 * 1000,
  });

  const subjects = useMemo(() => {
    const seen = new Map<string, TeacherSubject>();

    // 1) canonical catalog — source of truth
    for (const s of catalog) {
      const label = (s.name || "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      const matchedGlobal = globalSubjects.find(
        (g) => g.label.trim().toLowerCase() === key,
      );
      const matchedTextbook = teacherTextbooks.find(
        (tb: any) => tb.subject_id === s.id,
      );
      seen.set(key, {
        id: s.id,
        label,
        abbreviation: s.abbreviation ?? matchedGlobal?.abbreviation,
        color: s.color ?? matchedGlobal?.color,
        slug: matchedGlobal?.slug ?? matchedTextbook?.subject ?? undefined,
        source: "subject",
        teacherTextbookId: matchedTextbook?.id,
      });
    }

    // 2) legacy fallback: teacher's own textbooks not yet linked to a subject
    for (const tb of teacherTextbooks as any[]) {
      const label = (tb.title || "").trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (seen.has(key)) continue;
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

    // 3) legacy fallback: old global catalog
    for (const g of globalSubjects) {
      const key = g.label.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, {
        label: g.label,
        abbreviation: g.abbreviation,
        color: g.color,
        slug: g.slug,
        source: "global_subject",
      });
    }

    // 4) static fallback
    for (const name of PREDEFINED_SUBJECTS) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.set(key, { label: name, source: "predefined" });
    }

    return Array.from(seen.values()).sort((a, b) => {
      const order = {
        subject: 0,
        teacher_textbook: 1,
        global_subject: 2,
        predefined: 3,
      } as const;
      if (order[a.source] !== order[b.source]) return order[a.source] - order[b.source];
      return a.label.localeCompare(b.label, "cs");
    });
  }, [catalog, teacherTextbooks, globalSubjects]);

  return {
    subjects,
    loading: loadingCatalog || loadingGlobal || loadingTeacher,
  };
};

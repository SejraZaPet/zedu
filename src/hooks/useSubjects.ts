import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SubjectRecord {
  id: string;
  slug: string;
  label: string;
  abbreviation: string;
  description: string;
  color: string;
  active: boolean;
  sort_order: number;
  grades: GradeRecord[];
}

export interface GradeRecord {
  id: string;
  subject_id: string;
  grade_number: number;
  label: string;
  sort_order: number;
}

export const useSubjects = (activeOnly = true) => {
  return useQuery<SubjectRecord[]>({
    queryKey: ["textbook-subjects", activeOnly],
    queryFn: async () => {
      let q = supabase
        .from("textbook_subjects")
        .select("*, textbook_grades(*)")
        .order("sort_order");

      if (activeOnly) q = q.eq("active", true);

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((s: any) => ({
        id: s.id,
        slug: s.slug,
        label: s.label,
        abbreviation: s.abbreviation ?? "",
        description: s.description ?? "",
        color: s.color ?? "#c97755",
        active: s.active ?? true,
        sort_order: s.sort_order ?? 0,
        grades: ((s.textbook_grades ?? []) as any[])
          .sort((a: any, b: any) => a.sort_order - b.sort_order)
          .map((g: any) => ({
            id: g.id,
            subject_id: g.subject_id,
            grade_number: g.grade_number,
            label: g.label,
            sort_order: g.sort_order,
          })),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
};

/** Helpers that work on fetched data */
export const getSubjectBySlug = (subjects: SubjectRecord[], slug: string) =>
  subjects.find((s) => s.slug === slug);

export const getGradeNumbers = (subject: SubjectRecord): number[] =>
  subject.grades.map((g) => g.grade_number);

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SubjectGroupOption {
  id: string;
  name: string;
  subject_id: string;
  school_year: string;
  subjectName?: string | null;
  abbreviation?: string | null;
  color?: string | null;
}

/**
 * Aktivní (nearchivované) skupiny předmětu, které smí aktuální uživatel vidět
 * (vlastník / admin / člen — vynuceno RLS). Používá se jako alternativa k
 * `useTeacherClasses` tam, kde lze hodinu či zadání směrovat na skupinu.
 */
export const useSubjectGroups = () => {
  const { data = [], isLoading } = useQuery<SubjectGroupOption[]>({
    queryKey: ["subject-group-options"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const { data, error } = await supabase
        .from("subject_groups")
        .select("id, name, subject_id, school_year, subjects(name, abbreviation, color)")
        .eq("archived", false)
        .order("name");
      if (error) throw error;
      return ((data as any[]) ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        subject_id: g.subject_id,
        school_year: g.school_year,
        subjectName: g.subjects?.name ?? null,
        abbreviation: g.subjects?.abbreviation ?? null,
        color: g.subjects?.color ?? null,
      }));
    },
    staleTime: 60 * 1000,
  });

  return { groups: data, loading: isLoading };
};

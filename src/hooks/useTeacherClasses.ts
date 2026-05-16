import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherClassOption {
  id: string;
  name: string;
  school?: string | null;
  field_of_study?: string | null;
  year?: number | null;
}

/**
 * Returns the list of classes the current teacher belongs to (via class_teachers
 * or as the creator). Used for the "Třída" select inside the unified lesson
 * modal so teachers pick a real class instead of typing free text.
 */
export const useTeacherClasses = () => {
  const { data = [], isLoading } = useQuery<TeacherClassOption[]>({
    queryKey: ["teacher-classes-options"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const userId = session.user.id;

      // Načti třídy kde jsem učitel NEBO tvůrce
      const { data: classes, error } = await supabase
        .from("classes")
        .select("id, name, school, field_of_study, year, archived, created_by")
        .eq("archived", false)
        .or(`created_by.eq.${userId},id.in.(select class_id from class_teachers where user_id='${userId}')`)
        .order("name");

      if (error) throw error;
      return (classes ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        school: c.school,
        field_of_study: c.field_of_study,
        year: c.year,
      }));
    },
    staleTime: 60 * 1000,
  });

  return { classes: data, loading: isLoading };
};

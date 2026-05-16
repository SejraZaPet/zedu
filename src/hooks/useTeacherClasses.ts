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

      // 1) IDs tříd, kde jsem v class_teachers
      const { data: ctRows, error: ctErr } = await supabase
        .from("class_teachers")
        .select("class_id")
        .eq("user_id", userId);
      if (ctErr) throw ctErr;
      const memberIds = (ctRows ?? []).map((r: any) => r.class_id).filter(Boolean);

      // 2) Třídy, které jsem vytvořil NEBO ve kterých jsem učitel
      const orParts = [`created_by.eq.${userId}`];
      if (memberIds.length > 0) {
        orParts.push(`id.in.(${memberIds.join(",")})`);
      }

      const { data: classes, error } = await supabase
        .from("classes")
        .select("id, name, school, field_of_study, year, archived, created_by")
        .eq("archived", false)
        .or(orParts.join(","))
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

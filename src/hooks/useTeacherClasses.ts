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

      const [rolesRes, ctRes, createdRes, visibleRes] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId),
        supabase.from("class_teachers").select("class_id").eq("user_id", userId),
        supabase
          .from("classes")
          .select("id, name, school, field_of_study, year")
          .eq("archived", false)
          .eq("created_by", userId)
          .order("name"),
        supabase
          .from("classes")
          .select("id, name, school, field_of_study, year")
          .eq("archived", false)
          .order("name"),
      ]);

      if (rolesRes.error) throw rolesRes.error;
      if (ctRes.error) throw ctRes.error;
      if (createdRes.error) throw createdRes.error;
      if (visibleRes.error) throw visibleRes.error;

      const roles = new Set((rolesRes.data ?? []).map((r: any) => r.role));
      const canSeeAllVisibleClasses = roles.has("admin") || roles.has("school_admin");
      const memberIds = (ctRes.data ?? []).map((r: any) => r.class_id).filter(Boolean);
      const memberIdSet = new Set(memberIds);
      const byId = new Map<string, TeacherClassOption>();

      for (const c of (createdRes.data ?? []) as any[]) {
        byId.set(c.id, {
          id: c.id,
          name: c.name,
          school: c.school,
          field_of_study: c.field_of_study,
          year: c.year,
        });
      }

      for (const c of (visibleRes.data ?? []) as any[]) {
        if (!canSeeAllVisibleClasses && !memberIdSet.has(c.id) && !byId.has(c.id)) continue;
        byId.set(c.id, {
          id: c.id,
          name: c.name,
          school: c.school,
          field_of_study: c.field_of_study,
          year: c.year,
        });
      }

      return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "cs"));
    },
    staleTime: 60 * 1000,
  });

  return { classes: data, loading: isLoading };
};

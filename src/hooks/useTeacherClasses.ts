import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeacherClassOption {
  id: string;
  name: string;
  school?: string | null;
  field_of_study?: string | null;
  year?: number | null;
  /** `mine` = učitel třídu vlastní nebo v ní učí, `school` = existující třída školy, kterou ještě neučí. */
  source?: "mine" | "school";
}

/**
 * Returns the list of classes the current teacher belongs to (via class_teachers
 * or as the creator) plus the existing classes of their school, so the teacher
 * can pick a real class instead of creating a duplicate one.
 */
export const useTeacherClasses = () => {
  const { data = [], isLoading, refetch } = useQuery<TeacherClassOption[]>({
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
        // RLS pouští jen třídy, které učitel učí, vlastní, nebo které patří do jeho školy
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
          source: "mine",
        });
      }

      for (const c of (visibleRes.data ?? []) as any[]) {
        const mine = memberIdSet.has(c.id) || byId.get(c.id)?.source === "mine";
        byId.set(c.id, {
          id: c.id,
          name: c.name,
          school: c.school,
          field_of_study: c.field_of_study,
          year: c.year,
          source: mine ? "mine" : "school",
        });
      }

      return Array.from(byId.values()).sort((a, b) => {
        if (a.source !== b.source) return a.source === "mine" ? -1 : 1;
        return a.name.localeCompare(b.name, "cs");
      });
    },
    staleTime: 60 * 1000,
  });

  return {
    classes: data,
    /** Třídy, které učitel vlastní nebo v nich učí. */
    myClasses: data.filter((c) => c.source !== "school"),
    /** Existující třídy školy, které učitel zatím neučí — nabízejí se jako první volba. */
    schoolClasses: data.filter((c) => c.source === "school"),
    loading: isLoading,
    refetch,
  };
};

/**
 * Přihlásí učitele k výuce existující třídy školy (zapíše ho do class_teachers).
 * Volá se ve chvíli, kdy si třídu školy vybere pro úkol / hodinu / učebnici.
 */
export const claimSchoolClass = async (classId: string): Promise<string | null> => {
  const { error } = await supabase.rpc("claim_school_class_as_teacher", { _class_id: classId });
  return error ? error.message : null;
};

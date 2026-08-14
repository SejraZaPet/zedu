import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherClasses } from "./useTeacherClasses";

export interface MySubject {
  id: string;
  name: string;
  color?: string | null;
  abbreviation?: string | null;
  /** how the teacher got this subject */
  origin: "own" | "class";
}

/**
 * Subjects that belong to THIS teacher only — no predefined/global lists.
 * A subject qualifies when the teacher is its author (`subjects.created_by`)
 * or when it is used by one of the teacher's classes (`class_subjects`).
 */
export const useMySubjects = () => {
  const { user, loading: authLoading } = useAuth();
  const { classes } = useTeacherClasses();
  const classIds = (classes ?? []).map((c: any) => c.id).sort();

  const query = useQuery<MySubject[]>({
    queryKey: ["my-subjects", user?.id, classIds.join(",")],
    enabled: !authLoading && !!user,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const map = new Map<string, MySubject>();

      const { data: own, error: ownErr } = await supabase
        .from("subjects")
        .select("id, name, color, abbreviation")
        .eq("created_by", user!.id);
      if (ownErr) throw ownErr;
      for (const s of own ?? []) {
        map.set(s.id, { ...(s as any), origin: "own" });
      }

      if (classIds.length) {
        const { data: cs, error: csErr } = await supabase
          .from("class_subjects")
          .select("subject_id")
          .in("class_id", classIds);
        if (csErr) throw csErr;
        const ids = Array.from(
          new Set(((cs as any[]) ?? []).map((r) => r.subject_id).filter(Boolean)),
        ).filter((id) => !map.has(id));
        if (ids.length) {
          const { data: linked, error: lErr } = await supabase
            .from("subjects")
            .select("id, name, color, abbreviation")
            .in("id", ids);
          if (lErr) throw lErr;
          for (const s of linked ?? []) {
            map.set(s.id, { ...(s as any), origin: "class" });
          }
        }
      }

      return Array.from(map.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "cs"),
      );
    },
  });

  return {
    subjects: query.data ?? [],
    loading: authLoading || query.isLoading,
    refetch: query.refetch,
  };
};

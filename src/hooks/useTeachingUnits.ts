import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTeacherClasses } from "./useTeacherClasses";

/**
 * "Výuka" = jedna kombinace předmět × (třída | skupina předmětu).
 *
 * Zdrojem je SOUČET `class_subjects` (třídy) a `subject_groups` (skupiny) —
 * tedy vazby, které existují nezávisle na rozvrhu. Rozvrhové sloty se do
 * seznamu přidávají navíc (aby staré kombinace založené jen v rozvrhu
 * nezmizely), nikdy ale nejsou podmínkou.
 */
export interface TeachingUnit {
  key: string;
  kind: "class" | "group";
  subjectId: string;
  subjectName: string;
  abbreviation: string;
  color: string;
  /** classId nebo groupId podle `kind` */
  targetId: string;
  targetName: string;
  schoolYear?: string | null;
  /** true když vazba existuje jen díky rozvrhu (není v class_subjects) */
  fromScheduleOnly?: boolean;
  path: string;
}

const fallbackColor = (s: string) => {
  const palette = ["#6EC6D9", "#9B6CFF", "#F472B6", "#F87171", "#FB923C", "#FBBF24", "#34D399", "#60A5FA"];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};

export const useTeachingUnits = () => {
  const { user } = useAuth();
  const { classes, loading: loadingClasses } = useTeacherClasses();
  const classIds = (classes ?? []).map((c) => c.id).sort();

  const query = useQuery<TeachingUnit[]>({
    queryKey: ["teaching-units", user?.id ?? "anon", classIds.join(",")],
    enabled: !loadingClasses,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const classNames = new Map((classes ?? []).map((c) => [c.id, c.name]));
      const units = new Map<string, TeachingUnit>();
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id;

      const [csRes, groupsRes, slotsRes] = await Promise.all([
        classIds.length
          ? supabase
              .from("class_subjects")
              .select("class_id, subject_id, school_year, archived, subjects(id, name, abbreviation, color, archived)")
              .in("class_id", classIds)
              .eq("archived", false)
          : Promise.resolve({ data: [] as any[], error: null }),
        // Explicitní filtr na vlastníka: RLS adminovi vrací všechny skupiny,
        // v UI ale patří do "Výuky" jen vlastní.
        uid
          ? supabase
              .from("subject_groups")
              .select("id, name, school_year, subject_id, subjects(id, name, abbreviation, color, archived)")
              .eq("archived", false)
              .eq("created_by", uid)
          : Promise.resolve({ data: [] as any[], error: null }),
        classIds.length
          ? supabase
              .from("class_schedule_slots")
              .select("class_id, subject_id, subjects(id, name, abbreviation, color, archived)")
              .in("class_id", classIds)
              .not("subject_id", "is", null)
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      const push = (u: TeachingUnit) => {
        if (!units.has(u.key)) units.set(u.key, u);
      };

      const mk = (subj: any, kind: "class" | "group", targetId: string, targetName: string) => {
        const name = (subj?.name ?? "").trim();
        return {
          key: `${kind}:${subj?.id}:${targetId}`,
          kind,
          subjectId: subj?.id,
          subjectName: name,
          abbreviation: (subj?.abbreviation || name.slice(0, 3)).toUpperCase(),
          color: subj?.color || fallbackColor(name),
          targetId,
          targetName,
          path:
            kind === "class"
              ? `/ucitel/vyuka/${subj?.id}/trida/${targetId}`
              : `/ucitel/vyuka/${subj?.id}/skupina/${targetId}`,
        } as TeachingUnit;
      };

      for (const row of ((csRes as any).data ?? []) as any[]) {
        const subj = row.subjects;
        if (!subj || subj.archived) continue;
        push({
          ...mk(subj, "class", row.class_id, classNames.get(row.class_id) ?? ""),
          schoolYear: row.school_year ?? null,
        });
      }

      for (const row of ((groupsRes as any).data ?? []) as any[]) {
        const subj = row.subjects;
        if (!subj || subj.archived) continue;
        push({
          ...mk(subj, "group", row.id, row.name),
          schoolYear: row.school_year ?? null,
        });
      }

      for (const row of ((slotsRes as any).data ?? []) as any[]) {
        const subj = row.subjects;
        if (!subj || subj.archived) continue;
        push({
          ...mk(subj, "class", row.class_id, classNames.get(row.class_id) ?? ""),
          fromScheduleOnly: true,
        });
      }

      return Array.from(units.values()).sort((a, b) => {
        const c = a.subjectName.localeCompare(b.subjectName, "cs");
        if (c !== 0) return c;
        return a.targetName.localeCompare(b.targetName, "cs");
      });
    },
  });

  return { units: query.data ?? [], loading: loadingClasses || query.isLoading, refetch: query.refetch };
};

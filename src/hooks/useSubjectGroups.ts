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
  /** Skutečné předměty skupiny (rozvrh + učebnice); prázdné → jen `subject_id`. */
  subjectIds?: string[];
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
      // Explicitní filtr na vlastníka: RLS pouští adminovi (is_admin()) všechny
      // skupiny, v UI ale chceme vždy jen vlastní.
      const { data, error } = await supabase
        .from("subject_groups")
        .select("id, name, subject_id, school_year, subjects(name, abbreviation, color)")
        .eq("archived", false)
        .eq("created_by", session.user.id)
        .order("name");
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      const realSubjects = await fetchRealGroupSubjects(rows.map((g) => g.id));
      return rows.map((g) => {
        // Skupina je v DB často technicky vedená pod jiným předmětem (např. „Administrativa“).
        // Pro popisek bereme skutečné předměty z rozvrhu a učebnic skupiny.
        const real = realSubjects.get(g.id) ?? [];
        const first = real[0];
        return {
          id: g.id,
          name: g.name,
          subject_id: g.subject_id,
          school_year: g.school_year,
          subjectName: real.length ? real.map((r) => r.name).join(" / ") : g.subjects?.name ?? null,
          abbreviation: first ? first.abbreviation : g.subjects?.abbreviation ?? null,
          color: first ? first.color : g.subjects?.color ?? null,
          subjectIds: real.length ? real.map((r) => r.id) : [g.subject_id],
        };
      });
    },
    staleTime: 60 * 1000,
  });

  return { groups: data, loading: isLoading };
};

interface RealSubject { id: string; name: string; abbreviation: string | null; color: string | null }

/** Skutečné předměty skupin: z rozvrhových hodin (`group_id`) a z `subject_group_textbooks.subject_id`. */
export async function fetchRealGroupSubjects(groupIds: string[]): Promise<Map<string, RealSubject[]>> {
  const out = new Map<string, RealSubject[]>();
  if (groupIds.length === 0) return out;
  const [slotsRes, sgtRes] = await Promise.all([
    supabase.from("class_schedule_slots").select("group_id, subject_id").in("group_id", groupIds).not("subject_id", "is", null),
    supabase.from("subject_group_textbooks").select("subject_group_id, subject_id").in("subject_group_id", groupIds),
  ]);
  const pairs: Array<[string, string]> = [];
  for (const r of ((slotsRes.data as any[]) ?? [])) if (r.group_id && r.subject_id) pairs.push([r.group_id, r.subject_id]);
  for (const r of ((sgtRes.data as any[]) ?? [])) if (r.subject_group_id && r.subject_id) pairs.push([r.subject_group_id, r.subject_id]);
  const ids = [...new Set(pairs.map(([, s]) => s))];
  if (ids.length === 0) return out;
  const { data: subj } = await supabase.from("subjects").select("id, name, abbreviation, color, archived").in("id", ids);
  const byId = new Map<string, any>(((subj as any[]) ?? []).filter((s) => !s.archived).map((s) => [s.id, s]));
  for (const [gid, sid] of pairs) {
    const s = byId.get(sid);
    if (!s) continue;
    const list = out.get(gid) ?? [];
    if (!list.some((x) => x.id === sid)) list.push({ id: s.id, name: s.name, abbreviation: s.abbreviation ?? null, color: s.color ?? null });
    out.set(gid, list);
  }
  for (const list of out.values()) list.sort((a, b) => a.name.localeCompare(b.name, "cs"));
  return out;
}

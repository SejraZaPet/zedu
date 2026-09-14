import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slugify";
import { useSubjectCatalog } from "@/hooks/useSubjectCatalog";
import { useSubjects } from "@/hooks/useSubjects";

/**
 * Předměty pro formulář „Umístění v učebnicích".
 *
 * Zdrojem je to, co reálně existuje v `textbook_topics` (slug předmětu + ročník),
 * doplněné o názvy z kanonického katalogu `subjects`. Starý katalog
 * `textbook_subjects` se tu používá jen jako doplněk štítků a předmětů bez témat —
 * ročníky se z `textbook_grades` NEberou, protože tam u části předmětů chybí.
 */
export interface TopicSubjectOption {
  /** Slug tak, jak je uložen v `textbook_topics.subject`. */
  slug: string;
  label: string;
  /** Ročníky, pro které existuje alespoň jedno téma. */
  grades: number[];
}

/** `subjects.name` → klíč kompatibilní se slugy v `textbook_topics.subject`. */
export const topicSubjectKey = (value: string): string =>
  slugify(value).replace(/-/g, "_");

const humanize = (slug: string): string => {
  const words = slug.replace(/_/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : slug;
};

const TOPIC_SUBJECTS_KEY = ["topic-subject-options"] as const;

export const useTopicSubjectOptions = () => {
  const { subjects: catalog } = useSubjectCatalog();
  const { data: legacy = [] } = useSubjects(false);

  const { data: topicRows = [], isLoading } = useQuery<{ subject: string; grade: number }[]>({
    queryKey: TOPIC_SUBJECTS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("textbook_topics")
        .select("subject, grade");
      if (error) throw error;
      return (data ?? []) as { subject: string; grade: number }[];
    },
    staleTime: 60 * 1000,
  });

  const labelBySlug = new Map<string, string>();
  for (const s of legacy) labelBySlug.set(s.slug, s.label);
  for (const s of catalog) {
    const key = topicSubjectKey(s.name);
    if (!labelBySlug.has(key)) labelBySlug.set(key, s.name);
  }

  const gradesBySlug = new Map<string, Set<number>>();
  for (const row of topicRows) {
    if (!row.subject) continue;
    if (!gradesBySlug.has(row.subject)) gradesBySlug.set(row.subject, new Set());
    if (typeof row.grade === "number") gradesBySlug.get(row.subject)!.add(row.grade);
  }

  const slugs = new Set<string>([
    ...gradesBySlug.keys(),
    ...labelBySlug.keys(),
  ]);

  const options: TopicSubjectOption[] = Array.from(slugs)
    .map((slug) => ({
      slug,
      label: labelBySlug.get(slug) ?? humanize(slug),
      grades: Array.from(gradesBySlug.get(slug) ?? []).sort((a, b) => a - b),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"));

  return { options, loading: isLoading };
};

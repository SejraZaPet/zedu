import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SUBJECT_CATALOG_QUERY_KEY,
  fetchSubjectCatalog,
  type SubjectCatalogItem,
} from "@/lib/subjects-catalog";

/**
 * Canonical subject catalog (`subjects` table) — single source of truth.
 * Archived subjects are hidden by default so they are never offered for new
 * links; pass `{ includeArchived: true }` in management screens.
 */
export const useSubjectCatalog = (options?: { includeArchived?: boolean }) => {
  const includeArchived = options?.includeArchived ?? false;
  const query = useQuery<SubjectCatalogItem[]>({
    queryKey: SUBJECT_CATALOG_QUERY_KEY,
    queryFn: fetchSubjectCatalog,
    staleTime: 60 * 1000,
  });

  const all = query.data ?? [];

  return {
    subjects: includeArchived ? all : all.filter((s) => !s.archived),
    allSubjects: all,
    loading: query.isLoading,
    refetch: query.refetch,
  };
};

export const useInvalidateSubjectCatalog = () => {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: SUBJECT_CATALOG_QUERY_KEY });
    qc.invalidateQueries({ queryKey: ["teacher-subjects-unified"] });
  };
};

export type { SubjectCatalogItem };

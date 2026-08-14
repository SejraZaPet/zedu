import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SUBJECT_CATALOG_QUERY_KEY,
  fetchSubjectCatalog,
  type SubjectCatalogItem,
} from "@/lib/subjects-catalog";

/** Canonical subject catalog (`subjects` table) — single source of truth. */
export const useSubjectCatalog = () => {
  const query = useQuery<SubjectCatalogItem[]>({
    queryKey: SUBJECT_CATALOG_QUERY_KEY,
    queryFn: fetchSubjectCatalog,
    staleTime: 60 * 1000,
  });

  return {
    subjects: query.data ?? [],
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

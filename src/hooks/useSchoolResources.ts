import { useCallback, useEffect, useState } from "react";
import { fetchResources, type SchoolResource } from "@/lib/school-resources";

/** Seznam místností a inventáře dané školy. */
export function useSchoolResources(schoolId: string | null) {
  const [resources, setResources] = useState<SchoolResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!schoolId) {
      setResources([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResources(await fetchResources(schoolId));
    } catch (e: any) {
      setError(e?.message ?? "Nepodařilo se načíst položky.");
    } finally {
      setLoading(false);
    }
  }, [schoolId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { resources, loading, error, refetch };
}

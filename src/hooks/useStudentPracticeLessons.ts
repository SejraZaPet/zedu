import { useQuery } from "@tanstack/react-query";
import { fetchStudentPracticeLessons } from "@/lib/student-practice-lessons";

export const studentPracticeLessonsQueryKey = (userId: string) => ["student-practice-lessons", userId] as const;

/** Sdílené lekce pro všechny studijní dialogy; po pět minut se otevírají bez nového dotazu. */
export function useStudentPracticeLessons(userId: string | null | undefined) {
  return useQuery({
    queryKey: studentPracticeLessonsQueryKey(userId ?? "anonymous"),
    queryFn: () => fetchStudentPracticeLessons(userId!),
    enabled: Boolean(userId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

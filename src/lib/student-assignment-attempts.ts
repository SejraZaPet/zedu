import { supabase } from "@/integrations/supabase/client";

/** Read only through existing RLS; include the student's shared team work. */
export async function loadStudentAssignmentAttempts(studentId: string, assignmentIds: string[]) {
  if (!assignmentIds.length) return [];
  const { data: memberships, error: membershipError } = await supabase.from("assignment_group_members")
    .select("group_id").eq("student_id", studentId);
  if (membershipError) throw membershipError;
  const [own, shared] = await Promise.all([
    supabase.from("assignment_attempts").select("*").eq("student_id", studentId).in("assignment_id", assignmentIds),
    memberships?.length ? supabase.from("assignment_attempts").select("*")
      .in("group_id", memberships.map((m) => m.group_id)).in("assignment_id", assignmentIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (own.error) throw own.error;
  if (shared.error) throw shared.error;
  return [...new Map([...(own.data ?? []), ...(shared.data ?? [])].map((a) => [a.id, a])).values()];
}
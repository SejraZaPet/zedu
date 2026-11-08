import { supabase } from "@/integrations/supabase/client";

export interface TeacherDashboardCounts {
  assignments: number | null;
  todos: number | null;
  notifications: number | null;
}

export const EMPTY_DASHBOARD_COUNTS: TeacherDashboardCounts = {
  assignments: null, todos: null, notifications: null,
};

/** HEAD-only reads, scoped to the current owner; no rows or personal data returned. */
export async function loadTeacherDashboardCounts(userId: string, now = new Date()): Promise<TeacherDashboardCounts> {
  const safeCount = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
    try {
      const { count, error } = await query;
      return error || count === null || !Number.isFinite(count) || count <= 0 ? null : count;
    } catch { return null; }
  };
  const [assignments, todos, notifications] = await Promise.all([
    safeCount(supabase.from("assignments").select("id", { count: "exact", head: true })
      .eq("teacher_id", userId).eq("status", "published")
      .or("settings->>kind.is.null,settings->>kind.eq.task")
      .or(`deadline.is.null,deadline.gte.${now.toISOString()}`)),
    safeCount(supabase.from("todos").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("status", "pending")),
    safeCount(supabase.from("notifications").select("id", { count: "exact", head: true })
      .eq("recipient_id", userId).is("read_at", null)),
  ]);
  return { assignments, todos, notifications };
}
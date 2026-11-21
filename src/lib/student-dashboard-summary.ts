import { supabase } from "@/integrations/supabase/client";
import { bestAttemptsBy, type AttemptResultRow } from "@/lib/best-results";

export interface StudentDashboardSummary {
  xp: number;
  level: number;
  streakDays: number;
  monthAvgPct: number | null;
}

export interface DashboardAttempt extends AttemptResultRow {
  assignment_id: string;
}

/** Stejné pravidlo jako dosavadní Moje výsledky: jeden nejlepší pokus za úlohu. */
export function averageBestAttempts(attempts: readonly DashboardAttempt[]): number | null {
  const valid = attempts.filter((attempt) =>
    attempt.status === "submitted" && attempt.score != null && attempt.max_score != null && attempt.max_score > 0 && attempt.submitted_at,
  );
  const best = [...bestAttemptsBy(valid, (attempt) => attempt.assignment_id).values()];
  if (best.length === 0) return null;
  return Math.round(best.reduce((sum, attempt) => sum + (attempt.score! / attempt.max_score!) * 100, 0) / best.length);
}

/** Čte pouze vlastní existující herní profil a vlastní odevzdané pokusy. */
export async function loadStudentDashboardSummary(userId: string, now = new Date()): Promise<StudentDashboardSummary> {
  const since = new Date(now);
  since.setDate(since.getDate() - 30);
  const [{ data: xpRow }, { data: attempts }] = await Promise.all([
    supabase.from("student_xp").select("total_xp, level, streak_days").eq("student_id", userId).maybeSingle(),
    supabase.from("assignment_attempts")
      .select("assignment_id, score, max_score, submitted_at, status")
      .eq("student_id", userId)
      .eq("status", "submitted")
      .gte("submitted_at", since.toISOString()),
  ]);
  return {
    xp: xpRow?.total_xp ?? 0,
    level: xpRow?.level ?? 1,
    streakDays: xpRow?.streak_days ?? 0,
    monthAvgPct: averageBestAttempts((attempts ?? []) as DashboardAttempt[]),
  };
}

export function czechDays(count: number): string {
  return `${count} ${count === 1 ? "den" : count >= 2 && count <= 4 ? "dny" : "dní"}`;
}

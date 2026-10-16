import { useCallback, useRef } from "react";
import type { ActivityAnswer } from "@/lib/activity-answers";
import { supabase } from "@/integrations/supabase/client";

export const useActivityTracking = (lessonId: string | undefined) => {
  const savedRef = useRef<Set<string>>(new Set());

  const trackActivity = useCallback(
    async (activityIndex: number, activityType: string, score: number, maxScore: number, answers?: ActivityAnswer[]) => {
      if (!lessonId) return;
      const key = `${lessonId}-${activityIndex}${answers ? `-${JSON.stringify(answers)}` : ""}`;
      if (savedRef.current.has(key)) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      savedRef.current.add(key);

      const { error } = await supabase.from("student_activity_results").insert({
        user_id: session.user.id,
        lesson_id: lessonId,
        activity_index: activityIndex,
        activity_type: activityType,
        score,
        max_score: maxScore,
        ...(answers ? { answers: JSON.parse(JSON.stringify(answers)) } : {}),
      });
      if (error) savedRef.current.delete(key);
    },
    [lessonId]
  );

  const trackLessonComplete = useCallback(async () => {
    if (!lessonId) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from("student_lesson_completions").insert({
      user_id: session.user.id,
      lesson_id: lessonId,
    });
  }, [lessonId]);

  return { trackActivity, trackLessonComplete };
};

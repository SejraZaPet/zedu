import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export const useActivityTracking = (lessonId: string | undefined) => {
  const savedRef = useRef<Set<string>>(new Set());

  const trackActivity = useCallback(
    async (activityIndex: number, activityType: string, score: number, maxScore: number) => {
      if (!lessonId) return;
      const key = `${lessonId}-${activityIndex}`;
      if (savedRef.current.has(key)) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      savedRef.current.add(key);

      await supabase.from("student_activity_results").insert({
        user_id: session.user.id,
        lesson_id: lessonId,
        activity_index: activityIndex,
        activity_type: activityType,
        score,
        max_score: maxScore,
      });
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

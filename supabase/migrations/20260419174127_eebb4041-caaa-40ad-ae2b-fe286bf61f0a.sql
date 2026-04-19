CREATE POLICY "Parents can read linked student completions"
ON public.student_lesson_completions FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = auth.uid()
      AND student_id = student_lesson_completions.user_id
  )
);

CREATE POLICY "Parents can read linked student activity results"
ON public.student_activity_results FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = auth.uid()
      AND student_id = student_activity_results.user_id
  )
);

CREATE POLICY "Parents can read linked student assignment attempts"
ON public.assignment_attempts FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.parent_student_links
    WHERE parent_id = auth.uid()
      AND student_id = assignment_attempts.student_id
  )
);
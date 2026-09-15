ALTER TABLE public.assignment_attempts
  ADD COLUMN IF NOT EXISTS teacher_feedback_text text,
  ADD COLUMN IF NOT EXISTS teacher_feedback_emoji text,
  ADD COLUMN IF NOT EXISTS teacher_feedback_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_feedback_by uuid;

DROP POLICY IF EXISTS "Teachers can give feedback on own assignment attempts" ON public.assignment_attempts;
CREATE POLICY "Teachers can give feedback on own assignment attempts"
ON public.assignment_attempts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_attempts.assignment_id
      AND a.teacher_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = assignment_attempts.assignment_id
      AND a.teacher_id = auth.uid()
  )
);
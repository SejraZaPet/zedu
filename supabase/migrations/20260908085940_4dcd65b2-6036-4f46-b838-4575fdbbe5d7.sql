DROP POLICY IF EXISTS "Students can update own attempts" ON public.assignment_attempts;
CREATE POLICY "Students can update own attempts"
ON public.assignment_attempts
FOR UPDATE
TO authenticated
USING (
  auth.uid() = student_id
  AND status = 'in_progress'
)
WITH CHECK (
  auth.uid() = student_id
  AND status IN ('in_progress', 'submitted')
);
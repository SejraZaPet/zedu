DROP POLICY IF EXISTS "Teachers update own pending or rejected evidence" ON public.academy_evidence_submissions;

CREATE POLICY "Teachers resubmit own rejected evidence"
ON public.academy_evidence_submissions
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.academy_enrollments e
    WHERE e.id = academy_evidence_submissions.enrollment_id
      AND e.teacher_id = auth.uid()
  )
  AND status = 'rejected'
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.academy_enrollments e
    WHERE e.id = academy_evidence_submissions.enrollment_id
      AND e.teacher_id = auth.uid()
  )
  AND status = 'pending'
  AND reviewer_id IS NULL
  AND reviewer_comment IS NULL
  AND reviewed_at IS NULL
);
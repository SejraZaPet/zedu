-- Umožní učiteli vložit notifikaci o zpětné vazbě k úkolu žákovi,
-- ale jen pro assignment, který sám vlastní (payload->>'assignment_id').
CREATE POLICY "Teachers can send assignment feedback notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  type = 'assignment_feedback'
  AND sender_id = auth.uid()
  AND (payload->>'assignment_id') IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.assignments a
    WHERE a.id = (payload->>'assignment_id')::uuid
      AND a.teacher_id = auth.uid()
  )
);
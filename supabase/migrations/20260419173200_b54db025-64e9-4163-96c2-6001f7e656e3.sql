CREATE POLICY "Parents can read linked student profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.parent_student_links psl
    WHERE psl.parent_id = auth.uid()
      AND psl.student_id = profiles.id
  )
);
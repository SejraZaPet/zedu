CREATE POLICY "Parents can link themselves to a student"
ON public.parent_student_links
FOR INSERT
TO authenticated
WITH CHECK (parent_id = auth.uid());

CREATE POLICY "Parents can unlink themselves"
ON public.parent_student_links
FOR DELETE
TO authenticated
USING (parent_id = auth.uid());
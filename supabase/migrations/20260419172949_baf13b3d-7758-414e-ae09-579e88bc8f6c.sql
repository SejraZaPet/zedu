ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Parents can read their own links" ON public.parent_student_links;

CREATE POLICY "Parents can read their own links"
ON public.parent_student_links
FOR SELECT
TO authenticated
USING (parent_id = auth.uid());
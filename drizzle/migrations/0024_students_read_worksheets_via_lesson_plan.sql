CREATE OR REPLACE FUNCTION public.is_worksheet_in_student_lesson_plan(_worksheet_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lesson_plans p
    JOIN public.worksheets w ON w.id = _worksheet_id
    WHERE p.visible_to_students
      AND (p.visible_from IS NULL OR p.visible_from <= now())
      AND w.status = 'published'
      AND (
        _worksheet_id = ANY (p.worksheet_ids)
        OR (p.lesson_ref_id IS NOT NULL AND w.source_lesson_id = p.lesson_ref_id)
      )
      AND public.can_student_view_lesson_plan(p.class_id, p.group_id)
  )
$$;

DROP POLICY IF EXISTS "Students can read worksheets via lesson plan" ON public.worksheets;
CREATE POLICY "Students can read worksheets via lesson plan"
ON public.worksheets
FOR SELECT
TO authenticated
USING (public.is_worksheet_in_student_lesson_plan(id));
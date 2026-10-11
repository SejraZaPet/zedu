ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS show_in_lesson boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.can_student_view_worksheet_in_lesson(_worksheet_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.worksheets w
    WHERE w.id = _worksheet_id
      AND w.show_in_lesson = true
      AND w.status = 'published'
      AND (w.scheduled_publish_at IS NULL OR w.scheduled_publish_at <= now())
      AND w.source_lesson_id IS NOT NULL
      AND _user_id IS NOT NULL
      AND (
        (coalesce(w.source_lesson_type,'global') = 'global' AND public.can_view_textbook_lesson(w.source_lesson_id, _user_id))
        OR (w.source_lesson_type = 'teacher' AND public.can_view_teacher_textbook_lesson(w.source_lesson_id, _user_id))
      )
  )
$$;

REVOKE EXECUTE ON FUNCTION public.can_student_view_worksheet_in_lesson(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_student_view_worksheet_in_lesson(uuid, uuid) TO authenticated;

CREATE POLICY "Students can read worksheets shown in lesson"
ON public.worksheets FOR SELECT TO authenticated
USING (public.can_student_view_worksheet_in_lesson(id, auth.uid()));
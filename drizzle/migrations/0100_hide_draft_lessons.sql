CREATE POLICY hide_draft_lessons ON public.textbook_lessons
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (
    status = 'published'
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.user_roles ur
               WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','lektor'))
    OR EXISTS (SELECT 1 FROM public.lesson_topic_assignments a
               WHERE a.lesson_id = textbook_lessons.id AND a.status = 'published')
  );
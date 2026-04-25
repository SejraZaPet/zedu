CREATE TABLE public.worksheet_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id uuid NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL,
  lesson_type text NOT NULL CHECK (lesson_type IN ('global', 'teacher')),
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (worksheet_id, lesson_id, lesson_type)
);

CREATE INDEX idx_worksheet_lessons_worksheet ON public.worksheet_lessons(worksheet_id);
CREATE INDEX idx_worksheet_lessons_lesson ON public.worksheet_lessons(lesson_id, lesson_type);

ALTER TABLE public.worksheet_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own worksheet_lessons" ON public.worksheet_lessons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.worksheets w
      WHERE w.id = worksheet_lessons.worksheet_id AND w.teacher_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.worksheets w
      WHERE w.id = worksheet_lessons.worksheet_id AND w.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admin manage all worksheet_lessons" ON public.worksheet_lessons
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Students read worksheet_lessons via assignment" ON public.worksheet_lessons
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      LEFT JOIN public.class_members cm ON cm.class_id = a.class_id
      WHERE a.worksheet_id = worksheet_lessons.worksheet_id
        AND a.status = 'published'
        AND (cm.user_id = auth.uid() OR a.class_id IS NULL)
    )
  );

INSERT INTO public.worksheet_lessons (worksheet_id, lesson_id, lesson_type, added_by)
SELECT id, source_lesson_id, COALESCE(source_lesson_type, 'teacher'), teacher_id
FROM public.worksheets
WHERE source_lesson_id IS NOT NULL
ON CONFLICT DO NOTHING;
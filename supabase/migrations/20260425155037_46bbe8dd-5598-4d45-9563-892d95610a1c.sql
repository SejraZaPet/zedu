CREATE POLICY "Students can read class-linked teacher textbooks"
  ON public.teacher_textbooks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_textbooks ct
      JOIN public.class_members cm ON cm.class_id = ct.class_id
      WHERE ct.textbook_id = teacher_textbooks.id
        AND ct.textbook_type = 'teacher'
        AND cm.user_id = auth.uid()
    )
  );

CREATE POLICY "Students can read class-linked teacher textbook lessons"
  ON public.teacher_textbook_lessons FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.class_textbooks ct
      JOIN public.class_members cm ON cm.class_id = ct.class_id
      WHERE ct.textbook_id = teacher_textbook_lessons.textbook_id
        AND ct.textbook_type = 'teacher'
        AND cm.user_id = auth.uid()
    )
  );
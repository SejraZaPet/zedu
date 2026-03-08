
CREATE TABLE public.teacher_lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.teacher_textbook_lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.teacher_lesson_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own completions" ON public.teacher_lesson_completions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can read own completions" ON public.teacher_lesson_completions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admin can read all completions" ON public.teacher_lesson_completions
  FOR SELECT TO authenticated USING (is_admin());

CREATE POLICY "Teachers can read completions for own textbooks" ON public.teacher_lesson_completions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.teacher_textbook_lessons ttl
      JOIN public.teacher_textbooks tt ON tt.id = ttl.textbook_id
      WHERE ttl.id = teacher_lesson_completions.lesson_id
      AND tt.teacher_id = auth.uid()
    )
  );

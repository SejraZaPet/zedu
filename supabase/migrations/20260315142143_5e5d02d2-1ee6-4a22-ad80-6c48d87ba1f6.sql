
CREATE TABLE public.lesson_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id uuid REFERENCES public.textbook_lessons(id) ON DELETE CASCADE NOT NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  grade_band text NOT NULL DEFAULT '',
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  input_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.lesson_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can insert own lesson_plans"
  ON public.lesson_plans FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can read own lesson_plans"
  ON public.lesson_plans FOR SELECT TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own lesson_plans"
  ON public.lesson_plans FOR UPDATE TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own lesson_plans"
  ON public.lesson_plans FOR DELETE TO authenticated
  USING (auth.uid() = teacher_id);

CREATE POLICY "Admin can manage lesson_plans"
  ON public.lesson_plans FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());


CREATE TABLE public.lesson_reflections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL,
  lesson_plan_id UUID REFERENCES public.lesson_plans(id) ON DELETE SET NULL,
  subject TEXT,
  class_id UUID,
  reflection_date DATE,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  what_worked TEXT,
  what_to_change TEXT,
  quick_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_reflections_teacher ON public.lesson_reflections(teacher_id);
CREATE INDEX idx_lesson_reflections_plan ON public.lesson_reflections(lesson_plan_id);
CREATE INDEX idx_lesson_reflections_date ON public.lesson_reflections(reflection_date);

ALTER TABLE public.lesson_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers can view own reflections"
ON public.lesson_reflections FOR SELECT
USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Teachers can insert own reflections"
ON public.lesson_reflections FOR INSERT
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own reflections"
ON public.lesson_reflections FOR UPDATE
USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Teachers can delete own reflections"
ON public.lesson_reflections FOR DELETE
USING (auth.uid() = teacher_id OR public.is_admin());

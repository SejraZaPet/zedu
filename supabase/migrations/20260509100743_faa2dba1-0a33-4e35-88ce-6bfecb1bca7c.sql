CREATE TABLE public.lesson_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  phases_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_lesson_plan_templates_teacher ON public.lesson_plan_templates(teacher_id);

ALTER TABLE public.lesson_plan_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers view own templates"
ON public.lesson_plan_templates FOR SELECT
USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Teachers insert own templates"
ON public.lesson_plan_templates FOR INSERT
WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers update own templates"
ON public.lesson_plan_templates FOR UPDATE
USING (auth.uid() = teacher_id OR public.is_admin());

CREATE POLICY "Teachers delete own templates"
ON public.lesson_plan_templates FOR DELETE
USING (auth.uid() = teacher_id OR public.is_admin());
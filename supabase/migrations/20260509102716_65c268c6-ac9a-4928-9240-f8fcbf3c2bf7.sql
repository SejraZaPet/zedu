
CREATE TABLE public.learning_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  description TEXT,
  category TEXT CHECK (category IN ('aktivizacni','kooperativni','kriticke_mysleni','prezentacni','reflexni')),
  difficulty TEXT CHECK (difficulty IN ('snadna','stredni','pokrocila')),
  time_range TEXT,
  steps_json JSONB,
  tips TEXT,
  template_phases_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.learning_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read methods"
ON public.learning_methods FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins manage methods"
ON public.learning_methods FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE TABLE public.lesson_method_links (
  lesson_plan_id UUID NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  method_id UUID NOT NULL REFERENCES public.learning_methods(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_plan_id, method_id)
);

CREATE INDEX idx_lesson_method_links_method ON public.lesson_method_links(method_id);

ALTER TABLE public.lesson_method_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan owner can view method links"
ON public.lesson_method_links FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid())
  OR public.is_admin()
);

CREATE POLICY "Plan owner can insert method links"
ON public.lesson_method_links FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid())
);

CREATE POLICY "Plan owner can delete method links"
ON public.lesson_method_links FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid())
  OR public.is_admin()
);

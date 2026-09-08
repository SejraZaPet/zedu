CREATE TABLE public.lesson_plan_curriculum_coverage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_plan_id uuid NOT NULL REFERENCES public.lesson_plans(id) ON DELETE CASCADE,
  curriculum_topic_id uuid NOT NULL REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lesson_plan_id, curriculum_topic_id)
);

CREATE INDEX lesson_plan_curriculum_coverage_topic_idx ON public.lesson_plan_curriculum_coverage (curriculum_topic_id);
CREATE INDEX lesson_plan_curriculum_coverage_plan_idx ON public.lesson_plan_curriculum_coverage (lesson_plan_id);

GRANT SELECT, INSERT, DELETE ON public.lesson_plan_curriculum_coverage TO authenticated;
GRANT ALL ON public.lesson_plan_curriculum_coverage TO service_role;

ALTER TABLE public.lesson_plan_curriculum_coverage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner teacher can select lesson_plan_curriculum_coverage"
ON public.lesson_plan_curriculum_coverage FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid())
);

CREATE POLICY "Owner teacher can insert lesson_plan_curriculum_coverage"
ON public.lesson_plan_curriculum_coverage FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.curriculum_topics t
    JOIN public.teacher_curriculum_plans p ON p.id = t.curriculum_plan_id
    WHERE t.id = curriculum_topic_id AND p.teacher_id = auth.uid()
  )
);

CREATE POLICY "Owner teacher can delete lesson_plan_curriculum_coverage"
ON public.lesson_plan_curriculum_coverage FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.lesson_plans lp WHERE lp.id = lesson_plan_id AND lp.teacher_id = auth.uid())
);
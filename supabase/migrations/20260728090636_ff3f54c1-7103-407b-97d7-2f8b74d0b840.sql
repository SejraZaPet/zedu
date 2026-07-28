
-- 1) curriculum_topics
CREATE TABLE public.curriculum_topics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  curriculum_plan_id UUID NOT NULL REFERENCES public.teacher_curriculum_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_curriculum_topics_plan ON public.curriculum_topics(curriculum_plan_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.curriculum_topics TO authenticated;
GRANT ALL ON public.curriculum_topics TO service_role;

ALTER TABLE public.curriculum_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner teacher can select curriculum_topics"
ON public.curriculum_topics FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teacher_curriculum_plans p
  WHERE p.id = curriculum_plan_id AND p.teacher_id = auth.uid()
));

CREATE POLICY "Owner teacher can insert curriculum_topics"
ON public.curriculum_topics FOR INSERT TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teacher_curriculum_plans p
  WHERE p.id = curriculum_plan_id AND p.teacher_id = auth.uid()
));

CREATE POLICY "Owner teacher can update curriculum_topics"
ON public.curriculum_topics FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teacher_curriculum_plans p
  WHERE p.id = curriculum_plan_id AND p.teacher_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teacher_curriculum_plans p
  WHERE p.id = curriculum_plan_id AND p.teacher_id = auth.uid()
));

CREATE POLICY "Owner teacher can delete curriculum_topics"
ON public.curriculum_topics FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.teacher_curriculum_plans p
  WHERE p.id = curriculum_plan_id AND p.teacher_id = auth.uid()
));

-- 2) lesson_curriculum_coverage
CREATE TABLE public.lesson_curriculum_coverage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.teacher_textbook_lessons(id) ON DELETE CASCADE,
  curriculum_topic_id UUID NOT NULL REFERENCES public.curriculum_topics(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lesson_id, curriculum_topic_id)
);

CREATE INDEX idx_lcc_lesson ON public.lesson_curriculum_coverage(lesson_id);
CREATE INDEX idx_lcc_topic ON public.lesson_curriculum_coverage(curriculum_topic_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_curriculum_coverage TO authenticated;
GRANT ALL ON public.lesson_curriculum_coverage TO service_role;

ALTER TABLE public.lesson_curriculum_coverage ENABLE ROW LEVEL SECURITY;

-- Owner of both the lesson (via teacher_textbooks.teacher_id) and the curriculum topic
CREATE POLICY "Owner teacher can select lesson_curriculum_coverage"
ON public.lesson_curriculum_coverage FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons l
    JOIN public.teacher_textbooks tb ON tb.id = l.textbook_id
    WHERE l.id = lesson_id AND tb.teacher_id = auth.uid()
  )
);

CREATE POLICY "Owner teacher can insert lesson_curriculum_coverage"
ON public.lesson_curriculum_coverage FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons l
    JOIN public.teacher_textbooks tb ON tb.id = l.textbook_id
    WHERE l.id = lesson_id AND tb.teacher_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM public.curriculum_topics t
    JOIN public.teacher_curriculum_plans p ON p.id = t.curriculum_plan_id
    WHERE t.id = curriculum_topic_id AND p.teacher_id = auth.uid()
  )
);

CREATE POLICY "Owner teacher can delete lesson_curriculum_coverage"
ON public.lesson_curriculum_coverage FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons l
    JOIN public.teacher_textbooks tb ON tb.id = l.textbook_id
    WHERE l.id = lesson_id AND tb.teacher_id = auth.uid()
  )
);

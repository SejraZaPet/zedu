ALTER TABLE public.lesson_method_links
  DROP CONSTRAINT lesson_method_links_pkey;

ALTER TABLE public.lesson_method_links
  ALTER COLUMN lesson_plan_id DROP NOT NULL,
  ADD COLUMN lesson_id uuid REFERENCES public.teacher_textbook_lessons(id) ON DELETE CASCADE,
  ADD CONSTRAINT lesson_method_links_exactly_one_target CHECK (
    (lesson_plan_id IS NOT NULL AND lesson_id IS NULL)
    OR (lesson_plan_id IS NULL AND lesson_id IS NOT NULL)
  );

CREATE UNIQUE INDEX lesson_method_links_plan_method_uidx
  ON public.lesson_method_links (lesson_plan_id, method_id)
  WHERE lesson_plan_id IS NOT NULL;

CREATE UNIQUE INDEX lesson_method_links_lesson_method_uidx
  ON public.lesson_method_links (lesson_id, method_id)
  WHERE lesson_id IS NOT NULL;

DROP POLICY "Plan owner can view method links" ON public.lesson_method_links;
DROP POLICY "Plan owner can insert method links" ON public.lesson_method_links;
DROP POLICY "Plan owner can delete method links" ON public.lesson_method_links;

CREATE POLICY "Owner can view method links"
ON public.lesson_method_links
FOR SELECT
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM public.lesson_plans lp
    WHERE lp.id = lesson_method_links.lesson_plan_id AND lp.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons l
    JOIN public.teacher_textbooks t ON t.id = l.textbook_id
    WHERE l.id = lesson_method_links.lesson_id AND t.teacher_id = auth.uid()
  )
);

CREATE POLICY "Owner can insert method links"
ON public.lesson_method_links
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.lesson_plans lp
    WHERE lp.id = lesson_method_links.lesson_plan_id AND lp.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons l
    JOIN public.teacher_textbooks t ON t.id = l.textbook_id
    WHERE l.id = lesson_method_links.lesson_id AND t.teacher_id = auth.uid()
  )
);

CREATE POLICY "Owner can delete method links"
ON public.lesson_method_links
FOR DELETE
USING (
  is_admin()
  OR EXISTS (
    SELECT 1 FROM public.lesson_plans lp
    WHERE lp.id = lesson_method_links.lesson_plan_id AND lp.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.teacher_textbook_lessons l
    JOIN public.teacher_textbooks t ON t.id = l.textbook_id
    WHERE l.id = lesson_method_links.lesson_id AND t.teacher_id = auth.uid()
  )
);
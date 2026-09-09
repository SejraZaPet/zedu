ALTER TABLE public.lesson_method_links
  ADD COLUMN catalog_lesson_id uuid REFERENCES public.textbook_lessons(id) ON DELETE CASCADE,
  ADD COLUMN created_by uuid DEFAULT auth.uid();

ALTER TABLE public.lesson_method_links
  DROP CONSTRAINT lesson_method_links_exactly_one_target,
  ADD CONSTRAINT lesson_method_links_exactly_one_target CHECK (
    (CASE WHEN lesson_plan_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN lesson_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN catalog_lesson_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  );

CREATE UNIQUE INDEX lesson_method_links_catalog_method_uidx
  ON public.lesson_method_links (catalog_lesson_id, method_id, created_by)
  WHERE catalog_lesson_id IS NOT NULL;

DROP POLICY "Owner can view method links" ON public.lesson_method_links;
DROP POLICY "Owner can insert method links" ON public.lesson_method_links;
DROP POLICY "Owner can delete method links" ON public.lesson_method_links;

CREATE POLICY "Owner can view method links"
ON public.lesson_method_links
FOR SELECT
USING (
  is_admin()
  OR (catalog_lesson_id IS NOT NULL AND created_by = auth.uid())
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
  (catalog_lesson_id IS NOT NULL AND created_by = auth.uid() AND (public.is_teaching_staff(auth.uid()) OR is_admin()))
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

CREATE POLICY "Owner can delete method links"
ON public.lesson_method_links
FOR DELETE
USING (
  is_admin()
  OR (catalog_lesson_id IS NOT NULL AND created_by = auth.uid())
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
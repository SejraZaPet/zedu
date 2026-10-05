ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.teacher_textbooks ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.teacher_presentations ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.question_bank_items ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.textbook_lessons ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;
ALTER TABLE public.subject_groups ADD COLUMN IF NOT EXISTS is_demo_seed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.is_demo_user(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((
    SELECT s.is_demo FROM public.profiles p JOIN public.schools s ON s.id = p.school_id
    WHERE p.id = _user_id AND _user_id IS NOT NULL LIMIT 1
  ), false)
$$;
REVOKE ALL ON FUNCTION public.is_demo_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_demo_user(uuid) TO authenticated, service_role;

CREATE POLICY "demo_guard_update" ON public.worksheets AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.worksheets AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.teacher_textbooks AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.teacher_textbooks AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.teacher_presentations AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.teacher_presentations AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.assignments AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.assignments AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.question_bank_items AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.question_bank_items AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND teacher_id = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.classes AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND created_by = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND created_by = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.classes AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND created_by = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.subject_groups AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND created_by = auth.uid()))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND created_by = auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.subject_groups AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR (is_demo_seed = false AND created_by = auth.uid()));

CREATE POLICY "demo_guard_update" ON public.textbook_lessons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid())) WITH CHECK (NOT public.is_demo_user(auth.uid()));
CREATE POLICY "demo_guard_delete" ON public.textbook_lessons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()));

CREATE POLICY "demo_guard_update" ON public.teacher_textbook_lessons AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid() AND t.is_demo_seed = false))
  WITH CHECK (NOT public.is_demo_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid() AND t.is_demo_seed = false));
CREATE POLICY "demo_guard_delete" ON public.teacher_textbook_lessons AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR EXISTS (SELECT 1 FROM public.teacher_textbooks t WHERE t.id = textbook_id AND t.teacher_id = auth.uid() AND t.is_demo_seed = false));

NOTIFY pgrst, 'reload schema';
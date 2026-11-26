CREATE POLICY demo_iso_global_lessons ON public.textbook_lessons
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.is_demo_user(auth.uid()) OR is_demo_seed);
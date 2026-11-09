-- Rollback:
-- DROP POLICY IF EXISTS demo_iso_strict ON public.teacher_presentations;
-- DROP POLICY IF EXISTS demo_iso_strict ON public.teacher_textbooks;
CREATE POLICY demo_iso_strict ON public.teacher_presentations AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.is_demo_user(auth.uid())
  OR is_demo_seed
  OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid()))
);
CREATE POLICY demo_iso_strict ON public.teacher_textbooks AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.is_demo_user(auth.uid())
  OR is_demo_seed
  OR is_system
  OR public.is_public_shared_textbook(id)
  OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid()))
);
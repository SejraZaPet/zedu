-- Rollback: DROP POLICY IF EXISTS demo_iso_strict ON public.worksheets;
CREATE POLICY demo_iso_strict ON public.worksheets AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT public.is_demo_user(auth.uid())
  OR is_demo_seed
  OR teacher_id IN (SELECT public.demo_visible_user_ids(auth.uid()))
);
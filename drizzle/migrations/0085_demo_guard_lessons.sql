-- Rollback:
-- DROP POLICY IF EXISTS demo_guard_update ON public.lessons;
-- DROP POLICY IF EXISTS demo_guard_delete ON public.lessons;
CREATE POLICY demo_guard_update ON public.lessons AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT public.is_demo_user(auth.uid()));
CREATE POLICY demo_guard_delete ON public.lessons AS RESTRICTIVE FOR DELETE TO authenticated
USING (NOT public.is_demo_user(auth.uid()));
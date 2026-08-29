DROP POLICY IF EXISTS "pr_insert" ON public.profiles;

CREATE POLICY "profiles_insert_scoped"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin()
  OR (school_id IS NOT NULL AND public.is_school_admin_of(school_id, auth.uid()))
  OR (id = auth.uid() AND status = 'pending'::public.account_status)
);
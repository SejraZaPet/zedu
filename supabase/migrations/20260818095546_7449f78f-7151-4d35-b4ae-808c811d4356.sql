-- Helper: does the target profile belong to a privileged user?
CREATE OR REPLACE FUNCTION public.has_elevated_role(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'school_admin')
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_elevated_role(uuid) TO authenticated;

-- School admins may update profiles of their own school members only
DROP POLICY IF EXISTS "profiles_update_school_admin" ON public.profiles;
CREATE POLICY "profiles_update_school_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.is_school_admin(auth.uid())
  AND school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
  AND NOT public.has_elevated_role(id)
)
WITH CHECK (
  public.is_school_admin(auth.uid())
  AND (school_id IS NULL OR school_id = public.get_user_school_id(auth.uid()))
  AND NOT public.has_elevated_role(id)
);

-- Close cross-school leak in audit log
DROP POLICY IF EXISTS "Admins and school admins can view audit log" ON public.audit_log;
CREATE POLICY "Admins and school admins can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (
  public.is_admin()
  OR (
    public.is_school_admin(auth.uid())
    AND public.get_user_school_id(auth.uid()) IS NOT NULL
    AND actor_id IS NOT NULL
    AND public.get_user_school_id(actor_id) = public.get_user_school_id(auth.uid())
  )
);
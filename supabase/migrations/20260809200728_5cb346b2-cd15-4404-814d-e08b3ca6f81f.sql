CREATE POLICY "Active staff can view internal team profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_active_staff(auth.uid())
  AND (
    public.is_active_staff(id)
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = profiles.id AND ur.role = 'admin'::app_role)
  )
);
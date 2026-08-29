CREATE OR REPLACE FUNCTION public.can_reserve_resources(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('teacher', 'lektor', 'school_admin', 'admin')
  )
$$;

DROP POLICY IF EXISTS "Teachers can create own reservations" ON public.resource_reservations;

CREATE POLICY "Teachers can create own reservations"
ON public.resource_reservations FOR INSERT TO authenticated
WITH CHECK (
  reserved_by = auth.uid()
  AND public.resource_in_my_school(resource_id)
  AND public.can_reserve_resources(auth.uid())
);
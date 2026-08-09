DROP POLICY IF EXISTS user_roles_select_scoped ON public.user_roles;
CREATE POLICY user_roles_select_scoped ON public.user_roles
FOR SELECT
USING (
  user_id = auth.uid()
  OR is_admin()
  OR (is_school_admin(auth.uid()) AND get_user_school_id(user_id) IS NOT NULL AND get_user_school_id(user_id) = get_user_school_id(auth.uid()))
  OR is_teacher_of_student(user_id, auth.uid())
  OR is_parent_of_student(user_id, auth.uid())
  OR (role = 'admin'::app_role AND public.is_active_staff(auth.uid()))
);

CREATE POLICY "Active staff can view team members" ON public.staff_members
FOR SELECT
TO authenticated
USING (public.is_active_staff(auth.uid()));
CREATE OR REPLACE FUNCTION public.is_preview_owner(_student uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.preview_students WHERE student_id = _student AND owner_id = auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.is_preview_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_preview_owner(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.my_preview_student_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT student_id FROM public.preview_students WHERE owner_id = auth.uid()
$$;
REVOKE EXECUTE ON FUNCTION public.my_preview_student_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_preview_student_ids() TO authenticated;

CREATE POLICY preview_hide_class_members ON public.class_members AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR NOT public.is_preview_student(user_id) OR public.is_preview_owner(user_id));
CREATE POLICY preview_hide_group_members ON public.subject_group_members AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR NOT public.is_preview_student(student_id) OR public.is_preview_owner(student_id));
CREATE POLICY preview_hide_profiles ON public.profiles AS RESTRICTIVE
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR NOT public.is_preview_student(id) OR public.is_preview_owner(id));
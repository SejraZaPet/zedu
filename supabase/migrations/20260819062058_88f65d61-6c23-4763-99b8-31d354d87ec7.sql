CREATE POLICY "School members can view same school profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
);
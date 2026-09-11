CREATE POLICY "School admins can read school teacher_textbooks"
ON public.teacher_textbooks
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.profiles owner_profile
    WHERE owner_profile.id = teacher_textbooks.teacher_id
      AND public.is_school_admin_of(owner_profile.school_id, auth.uid())
  )
);
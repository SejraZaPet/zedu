CREATE POLICY "School admins upload school curriculum files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'curriculum-plans'
  AND (storage.foldername(name))[1] = 'school'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[2])::uuid, auth.uid())
  )
);

CREATE POLICY "School members read school curriculum files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'curriculum-plans'
  AND (storage.foldername(name))[1] = 'school'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[2])::uuid, auth.uid())
    OR ((storage.foldername(name))[2])::uuid = public.get_user_school_id(auth.uid())
  )
);

CREATE POLICY "School admins update school curriculum files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'curriculum-plans'
  AND (storage.foldername(name))[1] = 'school'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[2])::uuid, auth.uid())
  )
)
WITH CHECK (
  bucket_id = 'curriculum-plans'
  AND (storage.foldername(name))[1] = 'school'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[2])::uuid, auth.uid())
  )
);

CREATE POLICY "School admins delete school curriculum files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'curriculum-plans'
  AND (storage.foldername(name))[1] = 'school'
  AND (
    public.is_admin()
    OR public.is_school_admin_of(((storage.foldername(name))[2])::uuid, auth.uid())
  )
);
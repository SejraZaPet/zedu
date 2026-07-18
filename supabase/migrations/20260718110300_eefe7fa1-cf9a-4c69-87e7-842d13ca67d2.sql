DROP POLICY IF EXISTS "Admin can upload lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update lesson images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete lesson images" ON storage.objects;

CREATE POLICY "Admins and teachers can upload lesson images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-images' AND public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can update lesson images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-images' AND public.is_admin_or_teacher());

CREATE POLICY "Admins and teachers can delete lesson images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-images' AND public.is_admin_or_teacher());
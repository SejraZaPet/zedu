-- Policies for the new private bucket "assignment-uploads" (mirrors student-attachments).
-- Path convention: {assignment_id}/{student_id}/{filename}
CREATE POLICY "au_students_upload_own_folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assignment-uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "au_students_view_own_files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "au_students_delete_own_files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'assignment-uploads'
    AND auth.uid()::text = (storage.foldername(name))[2]
  );

CREATE POLICY "au_teachers_view_students_files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assignment-uploads'
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id::text = (storage.foldername(objects.name))[1]
        AND (
          a.teacher_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.class_teachers ct
            WHERE ct.class_id = a.class_id AND ct.user_id = auth.uid()
          )
        )
    )
  );

CREATE POLICY "au_admins_access_all"
  ON storage.objects FOR ALL
  USING (bucket_id = 'assignment-uploads' AND public.is_admin())
  WITH CHECK (bucket_id = 'assignment-uploads' AND public.is_admin());

-- Server-side file-type allowlist for this bucket only (no macros, no executables).
CREATE POLICY "au_allowed_types_insert"
  ON storage.objects AS RESTRICTIVE FOR INSERT
  WITH CHECK (
    bucket_id <> 'assignment-uploads'
    OR lower(name) ~ '\.(pdf|jpe?g|png|docx|xlsx|xls|csv)$'
  );

CREATE POLICY "au_allowed_types_update"
  ON storage.objects AS RESTRICTIVE FOR UPDATE
  USING (true)
  WITH CHECK (
    bucket_id <> 'assignment-uploads'
    OR lower(name) ~ '\.(pdf|jpe?g|png|docx|xlsx|xls|csv)$'
  );
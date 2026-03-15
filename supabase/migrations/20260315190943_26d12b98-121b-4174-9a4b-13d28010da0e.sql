
-- Drop pre-existing policy and recreate
DROP POLICY IF EXISTS "Teachers can read own exports" ON storage.objects;

CREATE POLICY "Teachers can read own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exports'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Private bucket for server-generated PDFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('generated-pdfs', 'generated-pdfs', false)
ON CONFLICT (id) DO NOTHING;

-- Teachers can manage files within their own user folder ({user_id}/...)
CREATE POLICY "Teachers can read own generated PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'generated-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can insert own generated PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'generated-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Teachers can delete own generated PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'generated-pdfs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

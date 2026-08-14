CREATE POLICY "Users manage own notebook media - select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'notebook-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users manage own notebook media - insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'notebook-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users manage own notebook media - update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'notebook-media' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users manage own notebook media - delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'notebook-media' AND (storage.foldername(name))[1] = auth.uid()::text);
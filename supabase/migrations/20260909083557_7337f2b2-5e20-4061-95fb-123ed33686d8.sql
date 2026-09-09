CREATE POLICY "assignment materials readable by signed in users"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'assignment-materials');

CREATE POLICY "teachers upload own assignment materials"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'assignment-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "teachers update own assignment materials"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'assignment-materials' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "teachers delete own assignment materials"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'assignment-materials' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "msg attach read participants" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='message-attachments'
  AND public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "msg attach upload participants" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='message-attachments'
  AND (storage.foldername(name))[2] = auth.uid()::text
  AND public.is_conversation_participant(((storage.foldername(name))[1])::uuid, auth.uid())
  AND lower(storage.extension(name)) IN ('pdf','jpg','jpeg','png'));
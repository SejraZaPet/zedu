CREATE POLICY "Users can read own class memberships"
ON public.class_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Authenticated can read reviews" ON public.content_reviews;
CREATE POLICY "Staff and reviewer read reviews" ON public.content_reviews
  FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid() OR public.is_admin_or_teacher());
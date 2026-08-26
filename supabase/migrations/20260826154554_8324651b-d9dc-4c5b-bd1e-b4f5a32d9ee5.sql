DROP POLICY IF EXISTS "Anyone can read published help articles" ON public.help_articles;

CREATE POLICY "Public can read published help articles"
  ON public.help_articles FOR SELECT TO anon
  USING (is_published = true);

CREATE POLICY "Signed-in users can read help articles"
  ON public.help_articles FOR SELECT TO authenticated
  USING (is_published = true OR public.is_admin());
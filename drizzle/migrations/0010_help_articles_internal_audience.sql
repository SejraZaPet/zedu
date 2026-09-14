DROP POLICY IF EXISTS "Public can read published help articles" ON public.help_articles;
DROP POLICY IF EXISTS "Signed-in users can read help articles" ON public.help_articles;

CREATE POLICY "Public can read published help articles"
  ON public.help_articles FOR SELECT TO anon
  USING (is_published = true AND coalesce(audience, 'all') <> 'internal');

CREATE POLICY "Signed-in users can read help articles"
  ON public.help_articles FOR SELECT TO authenticated
  USING (
    (is_published = true AND coalesce(audience, 'all') <> 'internal')
    OR public.is_admin()
    OR public.is_active_staff(auth.uid())
  );
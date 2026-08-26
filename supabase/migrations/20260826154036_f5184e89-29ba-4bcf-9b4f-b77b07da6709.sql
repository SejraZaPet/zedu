CREATE TABLE public.help_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  category text NOT NULL DEFAULT 'Obecné',
  content text NOT NULL DEFAULT '',
  cover_image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  audience text NOT NULL DEFAULT 'all',
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.help_articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_articles TO authenticated;
GRANT ALL ON public.help_articles TO service_role;

ALTER TABLE public.help_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published help articles"
  ON public.help_articles FOR SELECT
  USING (is_published = true OR public.is_admin());

CREATE POLICY "Admins can insert help articles"
  ON public.help_articles FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update help articles"
  ON public.help_articles FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete help articles"
  ON public.help_articles FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_help_articles_updated_at
  BEFORE UPDATE ON public.help_articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.help_articles (title, slug, category, content, audience, is_published, sort_order)
SELECT title, 'jak-zadavat-crm', 'CRM', content, 'all', true, 0
FROM public.staff_knowledge_articles
WHERE category = 'CRM'
ORDER BY created_at
LIMIT 1;

INSERT INTO public.help_articles (title, slug, category, audience, sort_order, is_published) VALUES
  ('Jak vytvořit třídu', 'jak-vytvorit-tridu', 'Začínáme', 'teacher', 1, false),
  ('Jak vytvořit předmět a přiřadit ho třídě', 'jak-vytvorit-predmet', 'Začínáme', 'teacher', 2, false),
  ('Jak vytvořit učebnici', 'jak-vytvorit-ucebnici', 'Učebnice', 'teacher', 3, false),
  ('Jak vytvořit lekci v učebnici', 'jak-vytvorit-lekci', 'Učebnice', 'teacher', 4, false),
  ('Jak vytvořit prezentaci', 'jak-vytvorit-prezentaci', 'Prezentace', 'teacher', 5, false);
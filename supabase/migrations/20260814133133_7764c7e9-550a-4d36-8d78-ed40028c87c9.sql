CREATE TABLE public.notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  subject text,
  cover_color text,
  related_lesson_id uuid REFERENCES public.textbook_lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebooks TO authenticated;
GRANT ALL ON public.notebooks TO service_role;
ALTER TABLE public.notebooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own notebooks" ON public.notebooks
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Owner can create own notebooks" ON public.notebooks
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can update own notebooks" ON public.notebooks
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owner can delete own notebooks" ON public.notebooks
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX idx_notebooks_owner ON public.notebooks(owner_id);
CREATE INDEX idx_notebooks_lesson ON public.notebooks(related_lesson_id);

CREATE TABLE public.notebook_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES public.notebooks(id) ON DELETE CASCADE,
  page_order integer NOT NULL DEFAULT 0,
  background_style text NOT NULL DEFAULT 'blank',
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notebook_pages_background_style_check
    CHECK (background_style IN ('blank','lined','grid','dotted'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notebook_pages TO authenticated;
GRANT ALL ON public.notebook_pages TO service_role;
ALTER TABLE public.notebook_pages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.owns_notebook(_notebook_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notebooks n
    WHERE n.id = _notebook_id AND n.owner_id = auth.uid()
  )
$$;

CREATE POLICY "Owner can view notebook pages" ON public.notebook_pages
  FOR SELECT TO authenticated USING (public.owns_notebook(notebook_id));
CREATE POLICY "Owner can create notebook pages" ON public.notebook_pages
  FOR INSERT TO authenticated WITH CHECK (public.owns_notebook(notebook_id));
CREATE POLICY "Owner can update notebook pages" ON public.notebook_pages
  FOR UPDATE TO authenticated USING (public.owns_notebook(notebook_id)) WITH CHECK (public.owns_notebook(notebook_id));
CREATE POLICY "Owner can delete notebook pages" ON public.notebook_pages
  FOR DELETE TO authenticated USING (public.owns_notebook(notebook_id));

CREATE INDEX idx_notebook_pages_notebook ON public.notebook_pages(notebook_id, page_order);

CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON public.notebooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notebook_pages_updated_at
  BEFORE UPDATE ON public.notebook_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
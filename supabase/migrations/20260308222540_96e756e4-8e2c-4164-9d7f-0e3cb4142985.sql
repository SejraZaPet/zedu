
CREATE TABLE public.help_guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  category text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.help_guides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published help_guides" ON public.help_guides
  FOR SELECT USING (status = 'published');

CREATE POLICY "Admin can manage help_guides" ON public.help_guides
  FOR ALL TO authenticated USING (is_admin_or_teacher()) WITH CHECK (is_admin_or_teacher());

CREATE TRIGGER update_help_guides_updated_at
  BEFORE UPDATE ON public.help_guides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

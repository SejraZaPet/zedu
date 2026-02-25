
-- Subjects table
CREATE TABLE public.textbook_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  label text NOT NULL,
  abbreviation text DEFAULT '',
  description text DEFAULT '',
  color text DEFAULT '#c97755',
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Grades table
CREATE TABLE public.textbook_grades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.textbook_subjects(id) ON DELETE CASCADE,
  grade_number integer NOT NULL,
  label text NOT NULL,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(subject_id, grade_number)
);

-- RLS for textbook_subjects
ALTER TABLE public.textbook_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read textbook_subjects" ON public.textbook_subjects
  FOR SELECT USING (true);
CREATE POLICY "Admin can insert textbook_subjects" ON public.textbook_subjects
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update textbook_subjects" ON public.textbook_subjects
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete textbook_subjects" ON public.textbook_subjects
  FOR DELETE USING (is_admin());

-- RLS for textbook_grades
ALTER TABLE public.textbook_grades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read textbook_grades" ON public.textbook_grades
  FOR SELECT USING (true);
CREATE POLICY "Admin can insert textbook_grades" ON public.textbook_grades
  FOR INSERT WITH CHECK (is_admin());
CREATE POLICY "Admin can update textbook_grades" ON public.textbook_grades
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admin can delete textbook_grades" ON public.textbook_grades
  FOR DELETE USING (is_admin());

-- Updated_at trigger for subjects
CREATE TRIGGER update_textbook_subjects_updated_at
  BEFORE UPDATE ON public.textbook_subjects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed existing subjects
INSERT INTO public.textbook_subjects (slug, label, description, sort_order) VALUES
  ('technologie', 'Technologie', 'Technologické postupy v gastronomii', 0),
  ('potraviny', 'Potraviny', 'Suroviny, kvalita a skladování', 1),
  ('svetova_gastronomie', 'Světová gastronomie', 'Kuchyně světa a jejich tradice', 2),
  ('nauka_o_vyzive', 'Nauka o výživě', 'Principy zdravé výživy a dietologie', 3);

-- Seed grades
INSERT INTO public.textbook_grades (subject_id, grade_number, label, sort_order)
SELECT s.id, g.n, g.n || '. ročník', g.n - 1
FROM public.textbook_subjects s
CROSS JOIN (VALUES (1), (2), (3)) AS g(n)
WHERE s.slug IN ('technologie', 'potraviny')

UNION ALL

SELECT s.id, 1, '1. ročník', 0
FROM public.textbook_subjects s
WHERE s.slug IN ('svetova_gastronomie', 'nauka_o_vyzive');

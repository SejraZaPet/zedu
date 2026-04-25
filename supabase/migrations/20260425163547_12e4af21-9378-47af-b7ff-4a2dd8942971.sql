-- 1. Tabulka worksheets
CREATE TABLE public.worksheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'Nový pracovní list',
  subject text NOT NULL DEFAULT '',
  grade_band text NOT NULL DEFAULT '',
  worksheet_mode text NOT NULL DEFAULT 'classwork' CHECK (worksheet_mode IN ('classwork', 'homework', 'test', 'revision')),
  spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  source_lesson_id uuid,
  source_lesson_type text CHECK (source_lesson_type IN ('global', 'teacher')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_worksheets_teacher ON public.worksheets(teacher_id, updated_at DESC);

ALTER TABLE public.worksheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own worksheets" ON public.worksheets
  FOR ALL TO authenticated
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Admin can manage all worksheets" ON public.worksheets
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER trg_worksheets_updated_at
  BEFORE UPDATE ON public.worksheets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Rozšířit assignments
ALTER TABLE public.assignments
  ADD COLUMN worksheet_id uuid REFERENCES public.worksheets(id) ON DELETE SET NULL;

CREATE INDEX idx_assignments_worksheet ON public.assignments(worksheet_id)
  WHERE worksheet_id IS NOT NULL;

-- 3. RLS pro studenty – čtení worksheetů přes assignment
CREATE POLICY "Students can read worksheets via assignment" ON public.worksheets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assignments a
      LEFT JOIN public.class_members cm ON cm.class_id = a.class_id
      WHERE a.worksheet_id = worksheets.id
        AND a.status = 'published'
        AND (cm.user_id = auth.uid() OR a.class_id IS NULL)
    )
  );

-- 4. RLS – přihlášení uživatelé mohou číst publikované worksheety (pro QR sken)
CREATE POLICY "Authenticated can read published worksheets" ON public.worksheets
  FOR SELECT TO authenticated
  USING (status = 'published');
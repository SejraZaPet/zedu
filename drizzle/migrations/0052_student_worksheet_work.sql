CREATE TABLE public.student_worksheet_work (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worksheet_id uuid NOT NULL REFERENCES public.worksheets(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  variant_id text NOT NULL DEFAULT 'A',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  score numeric,
  max_score numeric,
  assignment_id uuid REFERENCES public.assignments(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  submitted_at timestamptz
);
-- Jeden rozpracovaný koncept na žáka+list+variantu; odevzdané verze se hromadí.
CREATE UNIQUE INDEX student_worksheet_work_one_draft
  ON public.student_worksheet_work (worksheet_id, student_id, variant_id) WHERE status = 'draft';
CREATE INDEX student_worksheet_work_lookup
  ON public.student_worksheet_work (student_id, worksheet_id, updated_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.student_worksheet_work TO authenticated;
GRANT ALL ON public.student_worksheet_work TO service_role;
ALTER TABLE public.student_worksheet_work ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own worksheet work" ON public.student_worksheet_work
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Students insert own worksheet work" ON public.student_worksheet_work
  FOR INSERT TO authenticated WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.worksheets w WHERE w.id = worksheet_id AND w.status = 'published')
  );
CREATE POLICY "Students update own worksheet work" ON public.student_worksheet_work
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.worksheets w WHERE w.id = worksheet_id AND w.status = 'published')
  );
CREATE POLICY demo_iso ON public.student_worksheet_work AS RESTRICTIVE
  FOR ALL TO authenticated
  USING ((SELECT NOT public.is_demo_user(auth.uid())) OR public.demo_can_see_user(student_id))
  WITH CHECK ((SELECT NOT public.is_demo_user(auth.uid())) OR public.demo_can_see_user(student_id));

CREATE TRIGGER student_worksheet_work_updated_at BEFORE UPDATE ON public.student_worksheet_work
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TABLE public.staff_calendar_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date date NOT NULL,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (author_id, note_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_calendar_notes TO authenticated;
GRANT ALL ON public.staff_calendar_notes TO service_role;

ALTER TABLE public.staff_calendar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authors manage own calendar notes"
ON public.staff_calendar_notes
FOR ALL
TO authenticated
USING (author_id = auth.uid())
WITH CHECK (author_id = auth.uid());

CREATE TRIGGER update_staff_calendar_notes_updated_at
BEFORE UPDATE ON public.staff_calendar_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
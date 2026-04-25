-- Add optional link from worksheet to source lesson (for "Z lekce" palette section)
ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS source_lesson_id uuid NULL
  REFERENCES public.lessons(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_worksheets_source_lesson_id
  ON public.worksheets(source_lesson_id)
  WHERE source_lesson_id IS NOT NULL;
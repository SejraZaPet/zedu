ALTER TABLE public.worksheets DROP CONSTRAINT IF EXISTS worksheets_worksheet_mode_check;
ALTER TABLE public.worksheets ADD CONSTRAINT worksheets_worksheet_mode_check
  CHECK (worksheet_mode = ANY (ARRAY['classwork'::text, 'homework'::text, 'test'::text, 'revision'::text, 'exam'::text, 'project'::text]));
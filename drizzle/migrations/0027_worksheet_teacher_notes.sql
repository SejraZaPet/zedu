ALTER TABLE public.worksheets ADD COLUMN IF NOT EXISTS teacher_notes text NULL;
COMMENT ON COLUMN public.worksheets.teacher_notes IS 'Poznámky pro učitele – nikdy nezobrazovat žákům.';
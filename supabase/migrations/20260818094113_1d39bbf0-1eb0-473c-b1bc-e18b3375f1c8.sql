ALTER TABLE public.subjects ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS subjects_archived_idx ON public.subjects (archived);
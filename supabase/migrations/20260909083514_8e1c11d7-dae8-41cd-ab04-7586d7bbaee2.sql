ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.assignment_attempts ADD COLUMN IF NOT EXISTS submission_note text;
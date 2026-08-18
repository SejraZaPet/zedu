ALTER TABLE public.class_subjects
  ADD COLUMN IF NOT EXISTS textbook_id uuid,
  ADD COLUMN IF NOT EXISTS textbook_type text;

ALTER TABLE public.subject_groups
  ADD COLUMN IF NOT EXISTS textbook_id uuid,
  ADD COLUMN IF NOT EXISTS textbook_type text;
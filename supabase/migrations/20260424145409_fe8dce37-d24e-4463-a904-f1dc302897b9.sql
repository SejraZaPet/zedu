ALTER TABLE public.textbook_lessons ADD COLUMN IF NOT EXISTS presentation_slides jsonb;
ALTER TABLE public.teacher_textbook_lessons ADD COLUMN IF NOT EXISTS presentation_slides jsonb;
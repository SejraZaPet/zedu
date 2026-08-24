ALTER TABLE public.teacher_textbook_lessons ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'zedu-classic';
ALTER TABLE public.textbook_lessons ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'zedu-classic';
ALTER TABLE public.lesson_plans ADD COLUMN IF NOT EXISTS theme_id text DEFAULT 'zedu-classic';

ALTER TABLE public.teacher_textbooks
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'cs',
  ADD COLUMN IF NOT EXISTS difficulty_level text;

ALTER TABLE public.teacher_textbooks
  DROP CONSTRAINT IF EXISTS teacher_textbooks_language_chk;
ALTER TABLE public.teacher_textbooks
  ADD CONSTRAINT teacher_textbooks_language_chk
  CHECK (language IN ('cs','sk','en','other'));

ALTER TABLE public.teacher_textbooks
  DROP CONSTRAINT IF EXISTS teacher_textbooks_difficulty_chk;
ALTER TABLE public.teacher_textbooks
  ADD CONSTRAINT teacher_textbooks_difficulty_chk
  CHECK (difficulty_level IS NULL OR difficulty_level IN ('standard','simplified','advanced'));

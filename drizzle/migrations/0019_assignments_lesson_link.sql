ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS lesson_id uuid NULL,
  ADD COLUMN IF NOT EXISTS lesson_source text NULL;

ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_lesson_source_check;

ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_lesson_source_check
  CHECK (lesson_source IS NULL OR lesson_source IN ('textbook_lessons', 'teacher_textbook_lessons'));
ALTER TABLE public.teacher_presentations
  ADD COLUMN IF NOT EXISTS source_lesson_id uuid,
  ADD COLUMN IF NOT EXISTS source_lesson_type text;

CREATE UNIQUE INDEX IF NOT EXISTS teacher_presentations_teacher_source_lesson
  ON public.teacher_presentations(teacher_id, source_lesson_id)
  WHERE source_lesson_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
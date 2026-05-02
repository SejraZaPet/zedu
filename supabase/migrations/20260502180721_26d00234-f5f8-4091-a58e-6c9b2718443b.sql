ALTER TABLE public.class_schedule_slots
  ADD COLUMN IF NOT EXISTS textbook_id uuid,
  ADD COLUMN IF NOT EXISTS textbook_type text;

COMMENT ON COLUMN public.class_schedule_slots.textbook_id IS 'Optional link to a textbook (teacher_textbooks.id when textbook_type=teacher, textbook_subjects.id when textbook_type=global)';
COMMENT ON COLUMN public.class_schedule_slots.textbook_type IS 'teacher | global | NULL';

CREATE INDEX IF NOT EXISTS idx_class_schedule_slots_class ON public.class_schedule_slots(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedule_slots_textbook ON public.class_schedule_slots(textbook_id);

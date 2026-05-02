ALTER TABLE public.class_schedule_slots
  ADD COLUMN IF NOT EXISTS abbreviation text,
  ADD COLUMN IF NOT EXISTS color text;
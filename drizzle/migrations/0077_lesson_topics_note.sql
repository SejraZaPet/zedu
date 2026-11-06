ALTER TABLE public.lesson_topics ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE public.lesson_topics ADD CONSTRAINT lesson_topics_note_len CHECK (note IS NULL OR char_length(note) <= 1000);
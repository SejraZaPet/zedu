CREATE TABLE public.lesson_highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL,
  lesson_source text NOT NULL CHECK (lesson_source IN ('textbook_lessons', 'teacher_textbook_lessons')),
  block_id text NOT NULL,
  selected_text text NOT NULL,
  note text,
  color text DEFAULT 'yellow',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX lesson_highlights_user_lesson_idx ON public.lesson_highlights (user_id, lesson_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_highlights TO authenticated;
GRANT ALL ON public.lesson_highlights TO service_role;

ALTER TABLE public.lesson_highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own highlights" ON public.lesson_highlights
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own highlights" ON public.lesson_highlights
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own highlights" ON public.lesson_highlights
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users delete own highlights" ON public.lesson_highlights
  FOR DELETE TO authenticated USING (user_id = auth.uid());
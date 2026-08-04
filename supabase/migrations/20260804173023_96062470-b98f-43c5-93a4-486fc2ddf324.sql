CREATE TABLE public.teacher_game_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  purpose text,
  activity_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_game_mode text NOT NULL DEFAULT 'standard',
  default_team_mode text NOT NULL DEFAULT 'none',
  subject text,
  curriculum_topic_id uuid REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
  textbook_lesson_id uuid REFERENCES public.teacher_textbook_lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_game_templates TO authenticated;
GRANT ALL ON public.teacher_game_templates TO service_role;

ALTER TABLE public.teacher_game_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own game templates"
ON public.teacher_game_templates
FOR ALL
TO authenticated
USING (auth.uid() = teacher_id)
WITH CHECK (auth.uid() = teacher_id);

CREATE INDEX idx_teacher_game_templates_teacher ON public.teacher_game_templates(teacher_id, created_at DESC);

CREATE TRIGGER update_teacher_game_templates_updated_at
BEFORE UPDATE ON public.teacher_game_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
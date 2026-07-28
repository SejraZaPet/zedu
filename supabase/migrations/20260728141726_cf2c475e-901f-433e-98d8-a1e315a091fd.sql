CREATE TABLE public.question_bank_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject text,
  curriculum_topic_id uuid REFERENCES public.curriculum_topics(id) ON DELETE SET NULL,
  question_type text NOT NULL CHECK (question_type IN ('mcq','true_false','short_answer')),
  question_text text NOT NULL,
  choices jsonb,
  correct_index integer,
  correct_answer text,
  is_true boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX question_bank_items_teacher_idx ON public.question_bank_items (teacher_id);
CREATE INDEX question_bank_items_topic_idx ON public.question_bank_items (curriculum_topic_id);
CREATE INDEX question_bank_items_subject_idx ON public.question_bank_items (subject);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_bank_items TO authenticated;
GRANT ALL ON public.question_bank_items TO service_role;

ALTER TABLE public.question_bank_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teachers manage own question bank items"
  ON public.question_bank_items
  FOR ALL
  TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

CREATE TRIGGER update_question_bank_items_updated_at
  BEFORE UPDATE ON public.question_bank_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
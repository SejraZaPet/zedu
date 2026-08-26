CREATE TABLE public.teacher_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  slides jsonb NOT NULL DEFAULT '[]'::jsonb,
  lesson_id uuid REFERENCES public.teacher_textbook_lessons(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_presentations TO authenticated;
GRANT ALL ON public.teacher_presentations TO service_role;

ALTER TABLE public.teacher_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can view own presentations"
ON public.teacher_presentations FOR SELECT TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Owner can create own presentations"
ON public.teacher_presentations FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Owner can update own presentations"
ON public.teacher_presentations FOR UPDATE TO authenticated
USING (teacher_id = auth.uid()) WITH CHECK (teacher_id = auth.uid());

CREATE POLICY "Owner can delete own presentations"
ON public.teacher_presentations FOR DELETE TO authenticated
USING (teacher_id = auth.uid());

CREATE POLICY "Collaborators can view linked presentations"
ON public.teacher_presentations FOR SELECT TO authenticated
USING (
  lesson_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.teacher_textbook_lessons ttl
    JOIN public.teacher_textbooks tt ON tt.id = ttl.textbook_id
    JOIN public.teaching_unit_collaborators c ON c.subject_id = tt.subject_id
    WHERE ttl.id = public.teacher_presentations.lesson_id
      AND c.invited_teacher_id = auth.uid()
  )
);

CREATE INDEX idx_teacher_presentations_teacher ON public.teacher_presentations(teacher_id);
CREATE INDEX idx_teacher_presentations_lesson ON public.teacher_presentations(lesson_id);

CREATE TRIGGER trg_teacher_presentations_updated_at
BEFORE UPDATE ON public.teacher_presentations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
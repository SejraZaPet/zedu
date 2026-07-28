CREATE TABLE public.student_lesson_mastery (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES public.textbook_lessons(id) ON DELETE CASCADE,
  mastery_percent NUMERIC NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  mastered_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, lesson_id)
);

CREATE INDEX idx_lesson_mastery_student ON public.student_lesson_mastery(student_id);
CREATE INDEX idx_lesson_mastery_lesson ON public.student_lesson_mastery(lesson_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_lesson_mastery TO authenticated;
GRANT ALL ON public.student_lesson_mastery TO service_role;

ALTER TABLE public.student_lesson_mastery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own mastery"
ON public.student_lesson_mastery FOR ALL
TO authenticated
USING (auth.uid() = student_id)
WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Teachers view mastery of class students"
ON public.student_lesson_mastery FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.class_members cm
    JOIN public.class_teachers ct ON ct.class_id = cm.class_id
    WHERE cm.user_id = student_lesson_mastery.student_id
      AND ct.user_id = auth.uid()
  )
);

CREATE POLICY "Parents view their children's mastery"
ON public.student_lesson_mastery FOR SELECT
TO authenticated
USING (public.is_parent_of_student(auth.uid(), student_id));

CREATE POLICY "Admins view all mastery"
ON public.student_lesson_mastery FOR SELECT
TO authenticated
USING (public.is_admin());

CREATE TRIGGER update_student_lesson_mastery_updated_at
BEFORE UPDATE ON public.student_lesson_mastery
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create lesson_placements table for flexible multi-assignment of lessons
CREATE TABLE public.lesson_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id uuid NOT NULL REFERENCES public.teacher_textbook_lessons(id) ON DELETE CASCADE,
  subject_slug text NOT NULL,
  grade_number integer NOT NULL,
  topic_id uuid REFERENCES public.textbook_topics(id) ON DELETE SET NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lesson_id, subject_slug, grade_number, topic_id)
);

-- Enable RLS
ALTER TABLE public.lesson_placements ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admin can manage lesson_placements"
  ON public.lesson_placements FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Teacher can manage own lesson_placements"
  ON public.lesson_placements FOR ALL
  USING (public.is_admin_or_teacher())
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "Approved users can read lesson_placements"
  ON public.lesson_placements FOR SELECT
  USING (public.can_access_textbooks(auth.uid()));

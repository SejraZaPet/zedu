
ALTER TABLE public.teacher_textbook_lessons
  ADD COLUMN IF NOT EXISTS hero_image_url text,
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_teacher_textbook_lessons_scheduled
  ON public.teacher_textbook_lessons (scheduled_publish_at)
  WHERE status = 'scheduled';

-- Allow teachers (in addition to admins) to manage lesson_topic_assignments
DROP POLICY IF EXISTS "Teacher can insert lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Teacher can update lesson_topic_assignments" ON public.lesson_topic_assignments;
DROP POLICY IF EXISTS "Teacher can delete lesson_topic_assignments" ON public.lesson_topic_assignments;

CREATE POLICY "Teacher can insert lesson_topic_assignments"
  ON public.lesson_topic_assignments FOR INSERT
  WITH CHECK (public.is_admin_or_teacher());

CREATE POLICY "Teacher can update lesson_topic_assignments"
  ON public.lesson_topic_assignments FOR UPDATE
  USING (public.is_admin_or_teacher());

CREATE POLICY "Teacher can delete lesson_topic_assignments"
  ON public.lesson_topic_assignments FOR DELETE
  USING (public.is_admin_or_teacher());

-- Extend publish_due_lessons to also handle teacher lessons
CREATE OR REPLACE FUNCTION public.publish_due_lessons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c1 integer;
  _c2 integer;
BEGIN
  UPDATE public.textbook_lessons
     SET status = 'published',
         scheduled_publish_at = NULL,
         updated_at = now()
   WHERE status = 'scheduled'
     AND scheduled_publish_at IS NOT NULL
     AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _c1 = ROW_COUNT;

  UPDATE public.teacher_textbook_lessons
     SET status = 'published',
         scheduled_publish_at = NULL,
         updated_at = now()
   WHERE status = 'scheduled'
     AND scheduled_publish_at IS NOT NULL
     AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _c2 = ROW_COUNT;

  RETURN _c1 + _c2;
END;
$$;

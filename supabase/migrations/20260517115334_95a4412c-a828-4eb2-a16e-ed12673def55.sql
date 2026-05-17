
ALTER TABLE public.lesson_topic_assignments
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_lta_scheduled
  ON public.lesson_topic_assignments (scheduled_publish_at)
  WHERE status = 'scheduled';

ALTER TABLE public.lesson_placements
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_lp_scheduled
  ON public.lesson_placements (scheduled_publish_at)
  WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.publish_due_lessons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c1 integer;
  _c2 integer;
  _c3 integer;
  _c4 integer;
BEGIN
  UPDATE public.textbook_lessons
     SET status = 'published', scheduled_publish_at = NULL, updated_at = now()
   WHERE status = 'scheduled' AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _c1 = ROW_COUNT;

  UPDATE public.teacher_textbook_lessons
     SET status = 'published', scheduled_publish_at = NULL, updated_at = now()
   WHERE status = 'scheduled' AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _c2 = ROW_COUNT;

  UPDATE public.lesson_topic_assignments
     SET status = 'published', scheduled_publish_at = NULL
   WHERE status = 'scheduled' AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _c3 = ROW_COUNT;

  UPDATE public.lesson_placements
     SET status = 'published', scheduled_publish_at = NULL
   WHERE status = 'scheduled' AND scheduled_publish_at IS NOT NULL AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _c4 = ROW_COUNT;

  RETURN _c1 + _c2 + _c3 + _c4;
END;
$$;

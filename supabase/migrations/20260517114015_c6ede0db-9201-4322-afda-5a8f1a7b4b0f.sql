
ALTER TABLE public.textbook_lessons
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_textbook_lessons_scheduled
  ON public.textbook_lessons (scheduled_publish_at)
  WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.publish_due_lessons()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.textbook_lessons
     SET status = 'published',
         scheduled_publish_at = NULL,
         updated_at = now()
   WHERE status = 'scheduled'
     AND scheduled_publish_at IS NOT NULL
     AND scheduled_publish_at <= now();
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

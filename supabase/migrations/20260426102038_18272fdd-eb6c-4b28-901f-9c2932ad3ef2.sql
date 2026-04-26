
ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS scheduled_publish_at timestamptz;

ALTER TABLE public.worksheets
  DROP CONSTRAINT IF EXISTS worksheets_status_check;

ALTER TABLE public.worksheets
  ADD CONSTRAINT worksheets_status_check
  CHECK (status IN ('draft', 'published', 'scheduled'));

CREATE INDEX IF NOT EXISTS idx_worksheets_scheduled
  ON public.worksheets (scheduled_publish_at)
  WHERE status = 'scheduled';

CREATE OR REPLACE FUNCTION public.publish_due_worksheets()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.worksheets
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


-- Add worker_id column for tracking which worker claimed the job
ALTER TABLE public.export_jobs ADD COLUMN IF NOT EXISTS worker_id text;

-- Atomic dequeue function using FOR UPDATE SKIP LOCKED
CREATE OR REPLACE FUNCTION public.claim_export_job(_worker_id text)
RETURNS SETOF public.export_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _job public.export_jobs;
BEGIN
  SELECT * INTO _job
  FROM public.export_jobs
  WHERE status = 'queued'
    AND (started_at IS NULL OR started_at < now() - interval '15 minutes')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.export_jobs
  SET status = 'running',
      started_at = now(),
      attempt = attempt + 1,
      worker_id = _worker_id,
      error_message = NULL
  WHERE id = _job.id;

  _job.status := 'running';
  _job.started_at := now();
  _job.attempt := _job.attempt + 1;
  _job.worker_id := _worker_id;
  _job.error_message := NULL;

  RETURN NEXT _job;
  RETURN;
END;
$$;

-- Reaper function: reclaim stale running jobs (stuck > 15 min)
CREATE OR REPLACE FUNCTION public.reap_stale_export_jobs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _count integer;
BEGIN
  UPDATE public.export_jobs
  SET status = 'queued',
      worker_id = NULL,
      started_at = NULL
  WHERE status = 'running'
    AND started_at < now() - interval '15 minutes'
    AND attempt < max_attempts;

  GET DIAGNOSTICS _count = ROW_COUNT;

  -- Mark as failed if max attempts exceeded
  UPDATE public.export_jobs
  SET status = 'failed',
      completed_at = now(),
      error_message = 'Stale job exceeded max attempts'
  WHERE status = 'running'
    AND started_at < now() - interval '15 minutes'
    AND attempt >= max_attempts;

  RETURN _count;
END;
$$;

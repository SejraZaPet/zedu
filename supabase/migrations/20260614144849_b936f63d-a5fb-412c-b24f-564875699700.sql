
-- ============================================================
-- Rotate trigger functions to use new INTERNAL secrets
-- ============================================================

CREATE OR REPLACE FUNCTION public.trg_notify_parent_attempt_graded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/notify-parent';
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.score IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM 'submitted'
       OR OLD.score IS DISTINCT FROM NEW.score
     ) THEN
    PERFORM extensions.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-Internal-Secret','5941105d060d83987ce663977926313af753bda44569dcdc35ba810e827f3522'
      ),
      body := jsonb_build_object('kind','new_result','attempt_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_parent_assignment_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/notify-parent';
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND NEW.class_id IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-Internal-Secret','5941105d060d83987ce663977926313af753bda44569dcdc35ba810e827f3522'
      ),
      body := jsonb_build_object('kind','new_assignment','assignment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM extensions.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Internal-Secret','1386bd30944a86c98046935dfc1ccfb3ed653b36b6b8d3657848f0de9ffbfaf6'
    ),
    body := jsonb_build_object(
      'recipient_id', NEW.recipient_id,
      'title', NEW.title,
      'body', NEW.body,
      'link', NEW.link,
      'notification_id', NEW.id,
      'type', NEW.type
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

-- ============================================================
-- Rotate cron jobs (1, 3, 5, 6) to use new CRON_SECRET
-- ============================================================

SELECT cron.unschedule('reap-stale-export-jobs');
SELECT cron.schedule(
  'reap-stale-export-jobs',
  '*/5 * * * *',
  $cron$
  select
    net.http_post(
        url:='https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/reap-stale-jobs',
        headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmR0cGZta2FueGJja2RiZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODMwOTcsImV4cCI6MjA4ODU1OTA5N30.0Du0I5XHLyiiKFkoXjM1J8DMsGEiSJdm53BDkl0JCrA", "X-Cron-Secret": "5925aa6a074fb73485cb182f3ed74aa6762b97cc1e7d6cfbf0d0b5237aa6e504"}'::jsonb,
        body:=concat('{"time": "', now(), '"}')::jsonb
    ) as request_id;
  $cron$
);

SELECT cron.unschedule('publish-scheduled-worksheets-every-minute');
SELECT cron.schedule(
  'publish-scheduled-worksheets-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/publish-scheduled-worksheets',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmR0cGZta2FueGJja2RiZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODMwOTcsImV4cCI6MjA4ODU1OTA5N30.0Du0I5XHLyiiKFkoXjM1J8DMsGEiSJdm53BDkl0JCrA","X-Cron-Secret":"5925aa6a074fb73485cb182f3ed74aa6762b97cc1e7d6cfbf0d0b5237aa6e504"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $cron$
);

SELECT cron.unschedule('auto-reminders-job-daily');
SELECT cron.schedule(
  'auto-reminders-job-daily',
  '0 8 * * *',
  $cron$
  select net.http_post(
    url := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/auto-reminders-job',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmR0cGZta2FueGJja2RiZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODMwOTcsImV4cCI6MjA4ODU1OTA5N30.0Du0I5XHLyiiKFkoXjM1J8DMsGEiSJdm53BDkl0JCrA", "X-Cron-Secret": "5925aa6a074fb73485cb182f3ed74aa6762b97cc1e7d6cfbf0d0b5237aa6e504"}'::jsonb,
    body := concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $cron$
);

SELECT cron.unschedule('publish-scheduled-lessons-every-minute');
SELECT cron.schedule(
  'publish-scheduled-lessons-every-minute',
  '* * * * *',
  $cron$
  select net.http_post(
    url:='https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/publish-scheduled-lessons',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJubmR0cGZta2FueGJja2RiZmxtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5ODMwOTcsImV4cCI6MjA4ODU1OTA5N30.0Du0I5XHLyiiKFkoXjM1J8DMsGEiSJdm53BDkl0JCrA", "X-Cron-Secret": "5925aa6a074fb73485cb182f3ed74aa6762b97cc1e7d6cfbf0d0b5237aa6e504"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) as request_id;
  $cron$
);

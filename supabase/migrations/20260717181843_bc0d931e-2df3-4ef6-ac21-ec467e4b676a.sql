
-- 1) Create three new random secrets in Vault (only if they don't already exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notify_parent_internal_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'notify_parent_internal_secret', 'Shared secret between DB triggers and notify-parent edge function');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'send_push_internal_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'send_push_internal_secret', 'Shared secret between DB triggers and send-push edge function');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'cron_internal_secret') THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_internal_secret', 'Shared secret between pg_cron jobs and scheduled edge functions');
  END IF;
END$$;

-- 2) Rewrite trigger functions to read secret from Vault at runtime

CREATE OR REPLACE FUNCTION public.trg_notify_parent_assignment_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/notify-parent';
  _secret text;
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND NEW.class_id IS NOT NULL THEN
    SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
    WHERE name = 'notify_parent_internal_secret'
    LIMIT 1;

    PERFORM extensions.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-Internal-Secret', _secret
      ),
      body := jsonb_build_object('kind','new_assignment','assignment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_notify_parent_attempt_graded()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/notify-parent';
  _secret text;
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.score IS NOT NULL
     AND (
       TG_OP = 'INSERT'
       OR OLD.status IS DISTINCT FROM 'submitted'
       OR OLD.score IS DISTINCT FROM NEW.score
     ) THEN
    SELECT decrypted_secret INTO _secret
    FROM vault.decrypted_secrets
    WHERE name = 'notify_parent_internal_secret'
    LIMIT 1;

    PERFORM extensions.http_post(
      url := _url,
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'X-Internal-Secret', _secret
      ),
      body := jsonb_build_object('kind','new_result','attempt_id', NEW.id)
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
  _secret text;
BEGIN
  SELECT decrypted_secret INTO _secret
  FROM vault.decrypted_secrets
  WHERE name = 'send_push_internal_secret'
  LIMIT 1;

  PERFORM extensions.http_post(
    url := _url,
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'X-Internal-Secret', _secret
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

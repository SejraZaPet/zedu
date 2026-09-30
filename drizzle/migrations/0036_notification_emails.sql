ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.trg_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _secret text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.recipient_id AND p.email_notifications_enabled AND coalesce(p.email,'') <> ''
  ) THEN
    RETURN NEW;
  END IF;
  _secret := public.get_internal_secret('notify_parent_internal_secret');
  IF _secret IS NULL THEN RETURN NEW; END IF;
  PERFORM net.http_post(
    url := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/notify-email',
    headers := jsonb_build_object('Content-Type','application/json','X-Internal-Secret', _secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_notification_email() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notification_email_after_insert ON public.notifications;
CREATE TRIGGER notification_email_after_insert
AFTER INSERT ON public.notifications
FOR EACH ROW EXECUTE FUNCTION public.trg_notification_email();
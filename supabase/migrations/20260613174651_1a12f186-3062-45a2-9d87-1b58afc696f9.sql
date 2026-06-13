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
      'X-Internal-Secret','ad7e66fec60ca9ad27b8e5c355b845585233368663a949ec1c394d525bdcf610'
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
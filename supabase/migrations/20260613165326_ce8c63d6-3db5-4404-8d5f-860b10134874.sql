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
        'X-Internal-Secret','4ad50ab4461e6bce477fc5d949144e1e434f7861e6a281389b8dc8e2319fac8e'
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
        'X-Internal-Secret','4ad50ab4461e6bce477fc5d949144e1e434f7861e6a281389b8dc8e2319fac8e'
      ),
      body := jsonb_build_object('kind','new_result','attempt_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;
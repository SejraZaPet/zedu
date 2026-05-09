
-- Opt-in flag for parent emails
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS parent_email_notifications boolean NOT NULL DEFAULT true;

-- Trigger: assignment published -> notify-parent (kind=new_assignment)
CREATE OR REPLACE FUNCTION public.trg_notify_parent_assignment_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/notify-parent';
BEGIN
  IF NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND NEW.class_id IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := _url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('kind','new_assignment','assignment_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_parent_on_assignment_published ON public.assignments;
CREATE TRIGGER notify_parent_on_assignment_published
AFTER INSERT OR UPDATE OF status ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_parent_assignment_published();

-- Trigger: attempt submitted with score -> notify-parent (kind=new_result)
CREATE OR REPLACE FUNCTION public.trg_notify_parent_attempt_graded()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object('kind','new_result','attempt_id', NEW.id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_parent_on_attempt_graded ON public.assignment_attempts;
CREATE TRIGGER notify_parent_on_attempt_graded
AFTER INSERT OR UPDATE OF status, score ON public.assignment_attempts
FOR EACH ROW EXECUTE FUNCTION public.trg_notify_parent_attempt_graded();

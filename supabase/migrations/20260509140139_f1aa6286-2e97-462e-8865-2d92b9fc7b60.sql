
-- Push subscriptions table
CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

CREATE INDEX idx_push_subscriptions_user ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger: on new notification -> send web push via edge function
CREATE OR REPLACE FUNCTION public.trg_send_push_on_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _url text := 'https://rnndtpfmkanxbckdbflm.supabase.co/functions/v1/send-push';
BEGIN
  PERFORM extensions.http_post(
    url := _url,
    headers := jsonb_build_object('Content-Type','application/json'),
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
$$;

DROP TRIGGER IF EXISTS notifications_send_push ON public.notifications;
CREATE TRIGGER notifications_send_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.trg_send_push_on_notification();

-- Trigger: when an attempt is graded, create in-app notification for linked parents
CREATE OR REPLACE FUNCTION public.trg_notify_parents_on_grade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _student_name text;
  _assignment_title text;
BEGIN
  IF NEW.status = 'submitted'
     AND NEW.score IS NOT NULL
     AND (TG_OP = 'INSERT' OR OLD.score IS DISTINCT FROM NEW.score OR OLD.status IS DISTINCT FROM 'submitted')
  THEN
    SELECT first_name || ' ' || last_name INTO _student_name FROM public.profiles WHERE id = NEW.student_id;
    SELECT title INTO _assignment_title FROM public.assignments WHERE id = NEW.assignment_id;

    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      psl.parent_id,
      'attempt_graded',
      'Nový výsledek: ' || COALESCE(_student_name, 'Vaše dítě'),
      'Úkol „' || COALESCE(_assignment_title, 'Úkol') || '" byl ohodnocen: ' || NEW.score || '/' || COALESCE(NEW.max_score, 0) || ' bodů.',
      jsonb_build_object('attempt_id', NEW.id, 'assignment_id', NEW.assignment_id, 'student_id', NEW.student_id, 'score', NEW.score),
      '/rodic'
    FROM public.parent_student_links psl
    WHERE psl.student_id = NEW.student_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS attempts_notify_parents ON public.assignment_attempts;
CREATE TRIGGER attempts_notify_parents
AFTER INSERT OR UPDATE ON public.assignment_attempts
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_parents_on_grade();

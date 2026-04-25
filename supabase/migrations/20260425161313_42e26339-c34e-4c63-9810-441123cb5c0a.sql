
-- 1. Tabulka notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN (
    'assignment_new',
    'assignment_submitted',
    'assignment_deadline_soon',
    'class_textbook_added',
    'class_teacher_invited',
    'admin_message'
  )),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_recipient_unread 
  ON public.notifications(recipient_id, created_at DESC) 
  WHERE read_at IS NULL;
CREATE INDEX idx_notifications_recipient_all 
  ON public.notifications(recipient_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = recipient_id);

CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 2. Trigger: assignment_new
CREATE OR REPLACE FUNCTION public.notify_on_assignment_published()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') AND NEW.class_id IS NOT NULL THEN
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      cm.user_id,
      'assignment_new',
      'Nový úkol: ' || NEW.title,
      COALESCE(NEW.description, ''),
      jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id, 'deadline', NEW.deadline),
      '/student/ulohy/' || NEW.id::text
    FROM public.class_members cm
    WHERE cm.class_id = NEW.class_id;
    
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    SELECT 
      ct.user_id,
      'assignment_new',
      'Nový úkol ve třídě: ' || NEW.title,
      'Úkol byl publikován ve vaší třídě.',
      jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id),
      '/ucitel/ulohy'
    FROM public.class_teachers ct
    WHERE ct.class_id = NEW.class_id AND ct.user_id != NEW.teacher_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignment_published
AFTER INSERT OR UPDATE ON public.assignments
FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment_published();

-- 3. Trigger: assignment_submitted
CREATE OR REPLACE FUNCTION public.notify_on_attempt_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _teacher_id uuid;
  _assignment_title text;
  _student_name text;
BEGIN
  IF NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted' THEN
    SELECT a.teacher_id, a.title INTO _teacher_id, _assignment_title
    FROM public.assignments a WHERE a.id = NEW.assignment_id;
    
    SELECT (first_name || ' ' || last_name) INTO _student_name
    FROM public.profiles WHERE id = NEW.student_id;
    
    IF _teacher_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
      VALUES (
        _teacher_id,
        'assignment_submitted',
        'Žák odevzdal úkol',
        COALESCE(_student_name, 'Žák') || ' odevzdal úkol „' || COALESCE(_assignment_title, 'Úkol') || '".',
        jsonb_build_object('assignment_id', NEW.assignment_id, 'attempt_id', NEW.id, 'student_id', NEW.student_id),
        '/ucitel/ulohy'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_attempt_submitted
AFTER UPDATE ON public.assignment_attempts
FOR EACH ROW EXECUTE FUNCTION public.notify_on_attempt_submitted();

-- 4. Trigger: class_textbook_added
CREATE OR REPLACE FUNCTION public.notify_on_class_textbook_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _textbook_title text;
  _class_name text;
BEGIN
  IF NEW.textbook_type = 'global' THEN
    SELECT label INTO _textbook_title FROM public.textbook_subjects WHERE id = NEW.textbook_id;
  ELSE
    SELECT title INTO _textbook_title FROM public.teacher_textbooks WHERE id = NEW.textbook_id;
  END IF;
  
  SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;
  
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT 
    cm.user_id,
    'class_textbook_added',
    'Nová učebnice ve třídě',
    'Učebnice „' || COALESCE(_textbook_title, '') || '" byla přidána do třídy ' || COALESCE(_class_name, '') || '.',
    jsonb_build_object('class_id', NEW.class_id, 'textbook_id', NEW.textbook_id, 'textbook_type', NEW.textbook_type),
    '/student/ucebnice'
  FROM public.class_members cm
  WHERE cm.class_id = NEW.class_id;
  
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT 
    ct.user_id,
    'class_textbook_added',
    'Nová učebnice ve třídě',
    'Učebnice „' || COALESCE(_textbook_title, '') || '" byla přidána do třídy ' || COALESCE(_class_name, '') || '.',
    jsonb_build_object('class_id', NEW.class_id, 'textbook_id', NEW.textbook_id),
    '/ucitel/tridy'
  FROM public.class_teachers ct
  WHERE ct.class_id = NEW.class_id AND ct.user_id != COALESCE(NEW.added_by, '00000000-0000-0000-0000-000000000000'::uuid);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_class_textbook_added
AFTER INSERT ON public.class_textbooks
FOR EACH ROW EXECUTE FUNCTION public.notify_on_class_textbook_added();

-- 5. Trigger: class_teacher_invited
CREATE OR REPLACE FUNCTION public.notify_on_class_teacher_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _class_name text;
BEGIN
  IF NEW.role = 'co_teacher' THEN
    SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    VALUES (
      NEW.user_id,
      'class_teacher_invited',
      'Přidán/a do třídy',
      'Byl/a jsi přidán/a jako spoluučitel do třídy ' || COALESCE(_class_name, '') || '.',
      jsonb_build_object('class_id', NEW.class_id),
      '/ucitel/tridy'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_class_teacher_added
AFTER INSERT ON public.class_teachers
FOR EACH ROW EXECUTE FUNCTION public.notify_on_class_teacher_added();

-- 6. Funkce notify_deadline_soon
CREATE OR REPLACE FUNCTION public.notify_deadline_soon()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT DISTINCT
    cm.user_id,
    'assignment_deadline_soon',
    'Brzy končí termín úkolu',
    'Úkol „' || a.title || '" má termín do ' || to_char(a.deadline AT TIME ZONE 'Europe/Prague', 'DD.MM. HH24:MI') || '.',
    jsonb_build_object('assignment_id', a.id, 'class_id', a.class_id, 'deadline', a.deadline),
    '/student/ulohy/' || a.id::text
  FROM public.assignments a
  JOIN public.class_members cm ON cm.class_id = a.class_id
  WHERE a.status = 'published'
    AND a.deadline IS NOT NULL
    AND a.deadline > now()
    AND a.deadline <= now() + interval '24 hours'
    AND NOT EXISTS (
      SELECT 1 FROM public.assignment_attempts att
      WHERE att.assignment_id = a.id 
        AND att.student_id = cm.user_id
        AND att.status = 'submitted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = cm.user_id
        AND n.type = 'assignment_deadline_soon'
        AND n.payload->>'assignment_id' = a.id::text
        AND n.created_at > now() - interval '20 hours'
    );
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'notify-deadline-soon-daily',
      '0 7 * * *',
      $cron$ SELECT public.notify_deadline_soon(); $cron$
    );
  END IF;
END $$;

-- 7. Helper send_admin_notification
CREATE OR REPLACE FUNCTION public.send_admin_notification(
  _recipient_ids uuid[],
  _title text,
  _body text,
  _link text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admin can send admin notifications';
  END IF;
  
  INSERT INTO public.notifications (recipient_id, type, title, body, link)
  SELECT unnest(_recipient_ids), 'admin_message', _title, _body, _link;
  
  GET DIAGNOSTICS _count = ROW_COUNT;
  RETURN _count;
END;
$$;

-- 1) Rozšíření notifications o metadata (autor, typ cílení, stav)
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS sender_id uuid,
  ADD COLUMN IF NOT EXISTS sender_role text,
  ADD COLUMN IF NOT EXISTS receiver_type text,
  ADD COLUMN IF NOT EXISTS broadcast_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notifications_sender ON public.notifications(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_broadcast ON public.notifications(broadcast_id);

-- 2) Nová tabulka pro broadcasty (originál hromadné zprávy)
CREATE TABLE IF NOT EXISTS public.notification_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('admin','teacher','system')),
  receiver_type text NOT NULL CHECK (receiver_type IN ('user','class','group','all_teachers','all_students','all')),
  receiver_ids uuid[] NOT NULL DEFAULT '{}',
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'message' CHECK (type IN ('reminder','message','warning','info','update')),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','sent','cancelled','failed')),
  is_manual boolean NOT NULL DEFAULT true,
  link text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcasts_sender ON public.notification_broadcasts(sender_id);
CREATE INDEX IF NOT EXISTS idx_broadcasts_status ON public.notification_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_broadcasts_scheduled ON public.notification_broadcasts(scheduled_at) WHERE status = 'scheduled';

ALTER TABLE public.notification_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage all broadcasts"
  ON public.notification_broadcasts FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Authors can read own broadcasts"
  ON public.notification_broadcasts FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid());

CREATE POLICY "Authors can insert own broadcasts"
  ON public.notification_broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Authors can update own scheduled broadcasts"
  ON public.notification_broadcasts FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid() AND status = 'scheduled');

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_broadcasts_updated_at ON public.notification_broadcasts;
CREATE TRIGGER trg_broadcasts_updated_at
  BEFORE UPDATE ON public.notification_broadcasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Resolver: broadcast → seznam recipient_id
CREATE OR REPLACE FUNCTION public._resolve_broadcast_recipients(_b public.notification_broadcasts)
RETURNS TABLE(recipient_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _b.receiver_type = 'all' THEN
    RETURN QUERY SELECT p.id FROM public.profiles p;
  ELSIF _b.receiver_type = 'all_teachers' THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role IN ('admin','teacher');
  ELSIF _b.receiver_type = 'all_students' THEN
    RETURN QUERY
      SELECT DISTINCT ur.user_id FROM public.user_roles ur
      WHERE ur.role = 'user';
  ELSIF _b.receiver_type = 'class' THEN
    RETURN QUERY
      SELECT DISTINCT cm.user_id
      FROM public.class_members cm
      WHERE cm.class_id = ANY(_b.receiver_ids);
  ELSIF _b.receiver_type IN ('user','group') THEN
    RETURN QUERY SELECT unnest(_b.receiver_ids);
  END IF;
END;
$$;

-- 4) Hlavní fan-out funkce: vytvoří per-user notifikace z broadcastu
CREATE OR REPLACE FUNCTION public._fanout_broadcast(_broadcast_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b public.notification_broadcasts;
  _count integer;
BEGIN
  SELECT * INTO _b FROM public.notification_broadcasts WHERE id = _broadcast_id;
  IF _b IS NULL OR _b.status NOT IN ('scheduled','sent') THEN
    RETURN 0;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, type, title, body, link, payload,
    sender_id, sender_role, receiver_type, broadcast_id, status, is_manual, sent_at
  )
  SELECT DISTINCT
    r.recipient_id,
    CASE _b.sender_role
      WHEN 'admin' THEN 'admin_message'
      WHEN 'teacher' THEN 'teacher_message'
      ELSE 'system_message'
    END,
    _b.title,
    _b.content,
    _b.link,
    jsonb_build_object('broadcast_id', _b.id, 'msg_type', _b.type),
    _b.sender_id, _b.sender_role, _b.receiver_type, _b.id, 'sent', _b.is_manual, now()
  FROM public._resolve_broadcast_recipients(_b) r
  WHERE r.recipient_id IS NOT NULL;

  GET DIAGNOSTICS _count = ROW_COUNT;

  UPDATE public.notification_broadcasts
  SET status = 'sent', sent_at = now(), recipient_count = _count, updated_at = now()
  WHERE id = _broadcast_id;

  RETURN _count;
END;
$$;

-- 5) Veřejné RPC: send_notification (admin + učitel)
CREATE OR REPLACE FUNCTION public.send_notification(
  _title text,
  _content text,
  _receiver_type text,
  _receiver_ids uuid[] DEFAULT '{}',
  _type text DEFAULT 'message',
  _scheduled_at timestamptz DEFAULT NULL,
  _link text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _is_admin boolean;
  _is_teacher boolean;
  _sender_role text;
  _broadcast_id uuid;
  _cls uuid;
  _stu uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT public.is_admin() INTO _is_admin;
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role = 'teacher') INTO _is_teacher;

  IF _is_admin THEN
    _sender_role := 'admin';
  ELSIF _is_teacher THEN
    _sender_role := 'teacher';
  ELSE
    RAISE EXCEPTION 'Only admin or teacher can send notifications';
  END IF;

  -- Restrikce pro učitele: jen vlastní třídy / žáci ve vlastních třídách
  IF NOT _is_admin THEN
    IF _receiver_type IN ('all','all_teachers','all_students') THEN
      RAISE EXCEPTION 'Teachers cannot broadcast to global groups';
    END IF;

    IF _receiver_type = 'class' THEN
      FOREACH _cls IN ARRAY _receiver_ids LOOP
        IF NOT public.is_class_teacher(_cls, _uid) THEN
          RAISE EXCEPTION 'You are not teacher of class %', _cls;
        END IF;
      END LOOP;
    ELSIF _receiver_type IN ('user','group') THEN
      FOREACH _stu IN ARRAY _receiver_ids LOOP
        IF NOT EXISTS (
          SELECT 1 FROM public.class_members cm
          JOIN public.class_teachers ct ON ct.class_id = cm.class_id
          WHERE cm.user_id = _stu AND ct.user_id = _uid
        ) THEN
          RAISE EXCEPTION 'Student % is not in any of your classes', _stu;
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF _title IS NULL OR length(trim(_title)) = 0 THEN
    RAISE EXCEPTION 'Title is required';
  END IF;

  INSERT INTO public.notification_broadcasts (
    sender_id, sender_role, receiver_type, receiver_ids,
    title, content, type, status, is_manual, link, scheduled_at
  ) VALUES (
    _uid, _sender_role, _receiver_type, COALESCE(_receiver_ids, '{}'::uuid[]),
    _title, COALESCE(_content,''), _type,
    CASE WHEN _scheduled_at IS NOT NULL AND _scheduled_at > now() THEN 'scheduled' ELSE 'sent' END,
    true, _link, _scheduled_at
  )
  RETURNING id INTO _broadcast_id;

  -- Pokud není naplánované, rozešli hned
  IF _scheduled_at IS NULL OR _scheduled_at <= now() THEN
    PERFORM public._fanout_broadcast(_broadcast_id);
  END IF;

  RETURN _broadcast_id;
END;
$$;

-- 6) Cancel
CREATE OR REPLACE FUNCTION public.cancel_notification(_broadcast_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.notification_broadcasts;
BEGIN
  SELECT * INTO _row FROM public.notification_broadcasts WHERE id = _broadcast_id;
  IF _row IS NULL THEN RETURN false; END IF;

  IF NOT (public.is_admin() OR _row.sender_id = _uid) THEN
    RAISE EXCEPTION 'Not authorized to cancel this notification';
  END IF;

  IF _row.status <> 'scheduled' THEN
    RAISE EXCEPTION 'Only scheduled notifications can be cancelled';
  END IF;

  UPDATE public.notification_broadcasts
  SET status = 'cancelled', updated_at = now()
  WHERE id = _broadcast_id;

  RETURN true;
END;
$$;

-- 7) Dispatcher: rozešle všechny naplánované, jejichž čas nastal
CREATE OR REPLACE FUNCTION public.dispatch_scheduled_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _b public.notification_broadcasts;
  _total integer := 0;
BEGIN
  FOR _b IN
    SELECT * FROM public.notification_broadcasts
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= now()
    ORDER BY scheduled_at ASC
    LIMIT 100
  LOOP
    BEGIN
      PERFORM public._fanout_broadcast(_b.id);
      _total := _total + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.notification_broadcasts
      SET status = 'failed', error_message = SQLERRM, updated_at = now()
      WHERE id = _b.id;
    END;
  END LOOP;
  RETURN _total;
END;
$$;
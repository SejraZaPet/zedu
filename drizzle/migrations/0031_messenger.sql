CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct','group')),
  title text,
  created_by uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX ON public.conversation_participants(user_id);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL DEFAULT auth.uid(),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz
);
CREATE INDEX ON public.messages(conversation_id, created_at);
CREATE TABLE public.message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint NOT NULL DEFAULT 0,
  content_type text NOT NULL
);
CREATE TABLE public.message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL DEFAULT auth.uid(),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  resolved_by uuid,
  resolved_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations, public.conversation_participants, public.messages, public.message_attachments, public.message_reports TO authenticated;
GRANT ALL ON public.conversations, public.conversation_participants, public.messages, public.message_attachments, public.message_reports TO service_role;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id=_conv AND user_id=_user)
$$;
CREATE OR REPLACE FUNCTION public.messenger_is_teacher(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user AND role IN ('teacher','admin'))
$$;
CREATE OR REPLACE FUNCTION public.messenger_is_member(_user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user AND role IN ('teacher','admin','user'))
$$;
CREATE OR REPLACE FUNCTION public.messenger_conversation_type(_conv uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT type FROM public.conversations WHERE id=_conv
$$;
CREATE OR REPLACE FUNCTION public.messenger_conversation_creator(_conv uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT created_by FROM public.conversations WHERE id=_conv
$$;
CREATE OR REPLACE FUNCTION public.messenger_participant_count(_conv uuid)
RETURNS int LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT count(*)::int FROM public.conversation_participants WHERE conversation_id=_conv
$$;
CREATE OR REPLACE FUNCTION public.messenger_message_conversation(_msg uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT conversation_id FROM public.messages WHERE id=_msg
$$;
CREATE OR REPLACE FUNCTION public.can_resolve_message_report(_report uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_reports r
    JOIN public.messages m ON m.id=r.message_id
    JOIN public.profiles p ON p.id=m.sender_id
    WHERE r.id=_report AND p.school_id IS NOT NULL AND public.is_school_admin_of(p.school_id, _user)
  )
$$;

-- conversations
CREATE POLICY "participants read conversations" ON public.conversations FOR SELECT TO authenticated
  USING (public.is_conversation_participant(id, auth.uid()) OR created_by = auth.uid());
CREATE POLICY "create conversations" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    (type='group' AND public.messenger_is_teacher(auth.uid()))
    OR (type='direct' AND public.messenger_is_member(auth.uid()))));
CREATE POLICY "creator updates group title" ON public.conversations FOR UPDATE TO authenticated
  USING (created_by = auth.uid() AND type='group') WITH CHECK (created_by = auth.uid());

-- participants
CREATE POLICY "participants read participants" ON public.conversation_participants FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "creator adds participants" ON public.conversation_participants FOR INSERT TO authenticated
  WITH CHECK (
    public.messenger_conversation_creator(conversation_id) = auth.uid()
    AND (
      public.messenger_conversation_type(conversation_id)='group'
      OR (public.messenger_conversation_type(conversation_id)='direct'
          AND public.messenger_participant_count(conversation_id) < 2
          AND public.messenger_is_member(user_id))
    ));
CREATE POLICY "update own read marker" ON public.conversation_participants FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "leave or creator removes" ON public.conversation_participants FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.messenger_conversation_creator(conversation_id) = auth.uid());

-- messages
CREATE POLICY "participants read messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "participants send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "sender edits message" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid()) WITH CHECK (sender_id = auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "report context for school admin" ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.message_reports r WHERE r.message_id = messages.id AND public.can_resolve_message_report(r.id, auth.uid())));

-- attachments
CREATE POLICY "participants read attachments" ON public.message_attachments FOR SELECT TO authenticated
  USING (public.is_conversation_participant(public.messenger_message_conversation(message_id), auth.uid()));
CREATE POLICY "sender adds attachments" ON public.message_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.messages m WHERE m.id=message_id AND m.sender_id=auth.uid()));

-- reports
CREATE POLICY "participants report" ON public.message_reports FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND status='open'
    AND public.is_conversation_participant(public.messenger_message_conversation(message_id), auth.uid()));
CREATE POLICY "school admins read reports" ON public.message_reports FOR SELECT TO authenticated
  USING (public.can_resolve_message_report(id, auth.uid()));
CREATE POLICY "school admins resolve reports" ON public.message_reports FOR UPDATE TO authenticated
  USING (public.can_resolve_message_report(id, auth.uid())) WITH CHECK (public.can_resolve_message_report(id, auth.uid()));

-- notifications
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE sender_name text;
BEGIN
  SELECT trim(coalesce(first_name,'')||' '||coalesce(last_name,'')) INTO sender_name FROM public.profiles WHERE id=NEW.sender_id;
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link, sender_id)
  SELECT cp.user_id, 'new_message', 'Nová zpráva' || CASE WHEN coalesce(sender_name,'')<>'' THEN ' od '||sender_name ELSE '' END,
         left(coalesce(NEW.content,''), 140),
         jsonb_build_object('conversation_id', NEW.conversation_id, 'message_id', NEW.id),
         '/zpravy?c=' || NEW.conversation_id, NEW.sender_id
  FROM public.conversation_participants cp
  WHERE cp.conversation_id = NEW.conversation_id AND cp.user_id <> NEW.sender_id;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_new_message AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

CREATE OR REPLACE FUNCTION public.notify_on_message_reported()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m record; sid uuid;
BEGIN
  SELECT * INTO m FROM public.messages WHERE id = NEW.message_id;
  SELECT school_id INTO sid FROM public.profiles WHERE id = m.sender_id;
  IF sid IS NULL THEN SELECT school_id INTO sid FROM public.profiles WHERE id = NEW.reporter_id; END IF;
  IF sid IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link, sender_id)
  SELECT ur.user_id, 'message_reported', 'Nahlášená zpráva',
         left(coalesce(m.content,''), 140),
         jsonb_build_object('report_id', NEW.id, 'message_id', NEW.message_id, 'conversation_id', m.conversation_id,
                            'reason', NEW.reason, 'sender_id', m.sender_id,
                            'conversation_type', (SELECT type FROM public.conversations WHERE id=m.conversation_id)),
         '/zpravy/nahlaseni/' || NEW.id, NEW.reporter_id
  FROM public.user_roles ur JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'school_admin' AND p.school_id = sid;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_message_reported AFTER INSERT ON public.message_reports FOR EACH ROW EXECUTE FUNCTION public.notify_on_message_reported();

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reports;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='parent_messages') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_messages;
  END IF;
END $$;
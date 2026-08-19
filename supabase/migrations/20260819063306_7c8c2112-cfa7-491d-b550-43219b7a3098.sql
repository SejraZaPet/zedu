CREATE TYPE public.school_meeting_type AS ENUM ('predmetova','pedagogicka','ctvrtletni','pololetni','trictvrtletni','zaverecna');

CREATE TABLE public.school_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  type public.school_meeting_type NOT NULL DEFAULT 'pedagogicka',
  title text NOT NULL,
  meeting_date date NOT NULL DEFAULT CURRENT_DATE,
  content text,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_meetings TO authenticated;
GRANT ALL ON public.school_meetings TO service_role;
ALTER TABLE public.school_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view meetings" ON public.school_meetings
FOR SELECT TO authenticated
USING (school_id = public.get_user_school_id(auth.uid()) OR public.is_admin());

CREATE POLICY "School members can create meetings" ON public.school_meetings
FOR INSERT TO authenticated
WITH CHECK (author_id = auth.uid() AND school_id = public.get_user_school_id(auth.uid()));

CREATE POLICY "Author or school admin can update meetings" ON public.school_meetings
FOR UPDATE TO authenticated
USING (author_id = auth.uid() OR public.is_school_admin_of(school_id, auth.uid()) OR public.is_admin())
WITH CHECK (school_id = public.get_user_school_id(auth.uid()) OR public.is_admin());

CREATE POLICY "Author or school admin can delete meetings" ON public.school_meetings
FOR DELETE TO authenticated
USING (author_id = auth.uid() OR public.is_school_admin_of(school_id, auth.uid()) OR public.is_admin());

CREATE TRIGGER trg_school_meetings_updated_at
BEFORE UPDATE ON public.school_meetings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- helper: is a meeting in my school
CREATE OR REPLACE FUNCTION public.can_access_school_meeting(_meeting_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_meetings m
    WHERE m.id = _meeting_id
      AND m.school_id = public.get_user_school_id(auth.uid())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_access_school_meeting(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_access_school_meeting(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_manage_school_meeting(_meeting_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.school_meetings m
    WHERE m.id = _meeting_id
      AND (m.author_id = auth.uid() OR public.is_school_admin_of(m.school_id, auth.uid()) OR public.is_admin())
  );
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_school_meeting(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_school_meeting(uuid) TO authenticated;

CREATE TABLE public.school_meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.school_meetings(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  attended boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_meeting_attendees TO authenticated;
GRANT ALL ON public.school_meeting_attendees TO service_role;
ALTER TABLE public.school_meeting_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view attendees" ON public.school_meeting_attendees
FOR SELECT TO authenticated USING (public.can_access_school_meeting(meeting_id) OR public.is_admin());
CREATE POLICY "Meeting managers can manage attendees" ON public.school_meeting_attendees
FOR ALL TO authenticated
USING (public.can_manage_school_meeting(meeting_id))
WITH CHECK (public.can_manage_school_meeting(meeting_id));

CREATE TABLE public.school_meeting_acknowledgments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.school_meetings(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meeting_id, teacher_id)
);
GRANT SELECT, INSERT, DELETE ON public.school_meeting_acknowledgments TO authenticated;
GRANT ALL ON public.school_meeting_acknowledgments TO service_role;
ALTER TABLE public.school_meeting_acknowledgments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view acknowledgments" ON public.school_meeting_acknowledgments
FOR SELECT TO authenticated USING (public.can_access_school_meeting(meeting_id) OR public.is_admin());
CREATE POLICY "Teachers can acknowledge for themselves" ON public.school_meeting_acknowledgments
FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND public.can_access_school_meeting(meeting_id));
CREATE POLICY "Teachers can remove own acknowledgment" ON public.school_meeting_acknowledgments
FOR DELETE TO authenticated USING (teacher_id = auth.uid());

CREATE TABLE public.school_meeting_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.school_meetings(id) ON DELETE CASCADE,
  assigned_to uuid NOT NULL,
  task text NOT NULL,
  due_date date,
  todo_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_meeting_tasks TO authenticated;
GRANT ALL ON public.school_meeting_tasks TO service_role;
ALTER TABLE public.school_meeting_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "School members can view meeting tasks" ON public.school_meeting_tasks
FOR SELECT TO authenticated USING (public.can_access_school_meeting(meeting_id) OR public.is_admin());
CREATE POLICY "Meeting managers can manage meeting tasks" ON public.school_meeting_tasks
FOR ALL TO authenticated
USING (public.can_manage_school_meeting(meeting_id))
WITH CHECK (public.can_manage_school_meeting(meeting_id));

-- automaticky vytvoř todo pro přiřazeného učitele
CREATE OR REPLACE FUNCTION public.tg_meeting_task_to_todo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_author uuid;
  v_title text;
  v_todo uuid;
BEGIN
  SELECT m.author_id, m.title INTO v_author, v_title
  FROM public.school_meetings m WHERE m.id = NEW.meeting_id;

  INSERT INTO public.todos (user_id, assigned_by, title, description, type, priority, status, due_date)
  VALUES (
    NEW.assigned_to,
    v_author,
    NEW.task,
    'Úkol z porady: ' || COALESCE(v_title, ''),
    'task',
    'normal',
    'pending',
    NEW.due_date
  )
  RETURNING id INTO v_todo;

  NEW.todo_id := v_todo;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.tg_meeting_task_to_todo() FROM anon, authenticated, PUBLIC;

CREATE TRIGGER trg_meeting_task_to_todo
BEFORE INSERT ON public.school_meeting_tasks
FOR EACH ROW EXECUTE FUNCTION public.tg_meeting_task_to_todo();

CREATE INDEX idx_school_meetings_school ON public.school_meetings(school_id, meeting_date DESC);
CREATE INDEX idx_meeting_attendees_meeting ON public.school_meeting_attendees(meeting_id);
CREATE INDEX idx_meeting_acks_meeting ON public.school_meeting_acknowledgments(meeting_id);
CREATE INDEX idx_meeting_tasks_meeting ON public.school_meeting_tasks(meeting_id);
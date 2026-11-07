CREATE TABLE public.assignment_recipients (
  assignment_id uuid NOT NULL REFERENCES public.assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid NOT NULL DEFAULT auth.uid(),
  PRIMARY KEY (assignment_id, student_id)
);
CREATE INDEX assignment_recipients_student_idx ON public.assignment_recipients(student_id);
GRANT SELECT, INSERT, DELETE ON public.assignment_recipients TO authenticated;
GRANT ALL ON public.assignment_recipients TO service_role;
ALTER TABLE public.assignment_recipients ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.assignment_is_targeted(_aid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM assignment_recipients WHERE assignment_id = _aid) $$;

CREATE FUNCTION public.can_see_targeted_assignment(_aid uuid, _uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT assignment_is_targeted(_aid)
    OR EXISTS (SELECT 1 FROM assignment_recipients r WHERE r.assignment_id = _aid AND r.student_id = _uid)
    OR EXISTS (SELECT 1 FROM assignment_recipients r JOIN parent_student_links p
               ON p.student_id = r.student_id WHERE r.assignment_id = _aid AND p.parent_id = _uid)
    OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = _aid AND (a.teacher_id = _uid
               OR is_teaching_unit_collaborator(a.subject_id, a.class_id, a.group_id, _uid)))
    OR is_admin() $$;

CREATE POLICY recipients_only ON public.assignments AS RESTRICTIVE FOR SELECT TO authenticated
  USING (public.can_see_targeted_assignment(id, auth.uid()));

CREATE POLICY ar_select ON public.assignment_recipients FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()) OR is_admin());
CREATE POLICY ar_write ON public.assignment_recipients FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid())
    AND (EXISTS (SELECT 1 FROM assignments a JOIN class_members cm ON cm.class_id = a.class_id
                 WHERE a.id = assignment_id AND cm.user_id = student_id)
      OR EXISTS (SELECT 1 FROM assignments a JOIN subject_group_members m ON m.group_id = a.group_id
                 WHERE a.id = assignment_id AND m.student_id = student_id)));
CREATE POLICY ar_delete ON public.assignment_recipients FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM assignments a WHERE a.id = assignment_id AND a.teacher_id = auth.uid()));
CREATE POLICY demo_iso ON public.assignment_recipients AS RESTRICTIVE FOR ALL TO authenticated
  USING (NOT is_demo_user(auth.uid()) OR demo_can_see_assignment(assignment_id))
  WITH CHECK (NOT is_demo_user(auth.uid()) OR demo_can_see_assignment(assignment_id));

CREATE POLICY attempts_recipients_only ON public.assignment_attempts AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (public.can_see_targeted_assignment(assignment_id, auth.uid()));

CREATE FUNCTION public.notify_on_recipient_added() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a record;
BEGIN
  SELECT * INTO a FROM public.assignments WHERE id = NEW.assignment_id;
  IF a.id IS NULL OR a.status <> 'published' OR public.is_preview_student(NEW.student_id) THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.notifications n
             WHERE n.recipient_id = NEW.student_id AND n.type = 'assignment_new'
               AND n.payload->>'assignment_id' = a.id::text) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  VALUES (
    NEW.student_id, 'assignment_new',
    CASE COALESCE(a.settings->>'kind', 'task')
      WHEN 'material' THEN 'Nový materiál: '
      WHEN 'announcement' THEN 'Nové oznámení: '
      ELSE 'Nový úkol: '
    END || a.title,
    COALESCE(a.description, ''),
    jsonb_build_object('assignment_id', a.id, 'class_id', a.class_id, 'group_id', a.group_id, 'deadline', a.deadline, 'kind', COALESCE(a.settings->>'kind', 'task')),
    '/student/ulohy/' || a.id::text);
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.notify_on_recipient_added() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_assignment_recipient_added AFTER INSERT ON public.assignment_recipients
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_recipient_added();

CREATE OR REPLACE FUNCTION public.notify_on_assignment_published() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _targeted boolean;
BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
    _targeted := EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = NEW.id);
    IF NEW.class_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
      SELECT
        cm.user_id,
        'assignment_new',
        CASE COALESCE(NEW.settings->>'kind', 'task')
          WHEN 'material' THEN 'Nový materiál: '
          WHEN 'announcement' THEN 'Nové oznámení: '
          ELSE 'Nový úkol: '
        END || NEW.title,
        COALESCE(NEW.description, ''),
        jsonb_build_object('assignment_id', NEW.id, 'class_id', NEW.class_id, 'deadline', NEW.deadline, 'kind', COALESCE(NEW.settings->>'kind', 'task')),
        '/student/ulohy/' || NEW.id::text
      FROM public.class_members cm
      WHERE cm.class_id = NEW.class_id
        AND NOT public.is_preview_student(cm.user_id)
        AND (NOT _targeted OR EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = NEW.id AND r.student_id = cm.user_id));

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

    IF NEW.group_id IS NOT NULL THEN
      INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
      SELECT
        m.student_id,
        'assignment_new',
        CASE COALESCE(NEW.settings->>'kind', 'task')
          WHEN 'material' THEN 'Nový materiál: '
          WHEN 'announcement' THEN 'Nové oznámení: '
          ELSE 'Nový úkol: '
        END || NEW.title,
        COALESCE(NEW.description, ''),
        jsonb_build_object('assignment_id', NEW.id, 'group_id', NEW.group_id, 'deadline', NEW.deadline, 'kind', COALESCE(NEW.settings->>'kind', 'task')),
        '/student/ulohy/' || NEW.id::text
      FROM public.subject_group_members m
      WHERE m.group_id = NEW.group_id
        AND NOT public.is_preview_student(m.student_id)
        AND (NOT _targeted OR EXISTS (SELECT 1 FROM public.assignment_recipients r WHERE r.assignment_id = NEW.id AND r.student_id = m.student_id));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_deadline_soon() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT DISTINCT
    r.user_id,
    'assignment_deadline_soon',
    'Brzy končí termín úkolu',
    'Úkol „' || r.title || '" má termín do ' || to_char(r.deadline AT TIME ZONE 'Europe/Prague', 'DD.MM. HH24:MI') || '.',
    jsonb_build_object('assignment_id', r.assignment_id, 'class_id', r.class_id, 'group_id', r.group_id, 'deadline', r.deadline),
    '/student/ulohy/' || r.assignment_id::text
  FROM (
    SELECT a.id AS assignment_id, a.title, a.deadline, a.class_id, a.group_id, cm.user_id
    FROM public.assignments a
    JOIN public.class_members cm ON cm.class_id = a.class_id
    UNION ALL
    SELECT a.id, a.title, a.deadline, a.class_id, a.group_id, m.student_id
    FROM public.assignments a
    JOIN public.subject_group_members m ON m.group_id = a.group_id
  ) r
  WHERE EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = r.assignment_id
        AND a.status = 'published'
        AND a.deadline IS NOT NULL
        AND a.deadline > now()
        AND a.deadline <= now() + interval '24 hours'
    )
    AND NOT public.is_preview_student(r.user_id)
    AND (
      NOT EXISTS (SELECT 1 FROM public.assignment_recipients ar WHERE ar.assignment_id = r.assignment_id)
      OR EXISTS (SELECT 1 FROM public.assignment_recipients ar WHERE ar.assignment_id = r.assignment_id AND ar.student_id = r.user_id)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.assignment_attempts att
      WHERE att.assignment_id = r.assignment_id
        AND att.student_id = r.user_id
        AND att.status = 'submitted'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = r.user_id
        AND n.type = 'assignment_deadline_soon'
        AND n.payload->>'assignment_id' = r.assignment_id::text
        AND n.created_at > now() - interval '20 hours'
    );

  -- Osobní úkoly (todos): termín zítra, nesplněné (beze změny)
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT
    t.user_id,
    'todo_deadline_soon',
    'Zítra vyprší termín úkolu',
    left(t.title, 80),
    jsonb_build_object('todo_id', t.id, 'due_date', t.due_date),
    '/todo'
  FROM public.todos t
  WHERE t.due_date = CURRENT_DATE + 1
    AND t.status <> 'done'
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.recipient_id = t.user_id
        AND n.type = 'todo_deadline_soon'
        AND n.payload->>'todo_id' = t.id::text
        AND n.created_at > now() - interval '20 hours' + interval '4 hours'
    );
END;
$$;
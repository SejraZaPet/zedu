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
        AND n.created_at > now() - interval '24 hours'
    );
END;
$$;
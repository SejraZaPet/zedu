# Úkol jen pro vybrané žáky – ROLLBACK (NESPOUŠTĚT bez pokynu)

Proběhlé migrace: `0080_assignment_recipients.sql`, `0081_fix_todo_deadline_interval.sql`.

## Rollback (jedna migrace, v tomto pořadí)

```sql
DROP TRIGGER IF EXISTS trg_assignment_recipient_added ON public.assignment_recipients;
DROP FUNCTION IF EXISTS public.notify_on_recipient_added();
DROP POLICY IF EXISTS attempts_recipients_only ON public.assignment_attempts;
DROP POLICY IF EXISTS recipients_only ON public.assignments;
-- obnovit původní těla funkcí (níže) PŘED smazáním tabulky, na kterou odkazují
-- <ORIGINAL notify_on_assignment_published>
-- <ORIGINAL notify_deadline_soon>
DROP TABLE IF EXISTS public.assignment_recipients;
DROP FUNCTION IF EXISTS public.can_see_targeted_assignment(uuid, uuid);
DROP FUNCTION IF EXISTS public.assignment_is_targeted(uuid);
```

### Původní notify_on_assignment_published (doslova)
```sql
CREATE OR REPLACE FUNCTION public.notify_on_assignment_published() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$

BEGIN
  IF NEW.status = 'published' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published') THEN
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
        AND NOT public.is_preview_student(cm.user_id);

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
        AND NOT public.is_preview_student(m.student_id);
    END IF;
  END IF;
  RETURN NEW;
END;

$$;
```

### Původní notify_deadline_soon (doslova)
```sql
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
```

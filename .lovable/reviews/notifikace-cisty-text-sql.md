# Návrh SQL: čistý text v notifikacích (NESPUŠTĚNO, čeká na schválení)

Týká se funkce `public.notify_on_assignment_published` (naposledy v `drizzle/migrations/0080_assignment_recipients.sql`, titulky z 0079). Sloupec je `notifications.body`. Mění se jen dva řádky `COALESCE(NEW.description, '')` → `public.notification_plain_text(NEW.description, 200)`; zbytek je doslovná živá verze.

```sql
-- Návrh ke schválení (NESPUŠTĚNO). Nový pomocník + výměna dvou řádků v notify_on_assignment_published (živá verze z 0080).
CREATE OR REPLACE FUNCTION public.notification_plain_text(_html text, _max int DEFAULT 200)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE WHEN length(t) > _max THEN rtrim(left(t, _max - 1)) || '…' ELSE t END
  FROM (SELECT btrim(regexp_replace(
    replace(replace(replace(replace(replace(
      regexp_replace(COALESCE(_html, ''), '<[^>]*>', ' ', 'g'),
      '&nbsp;', ' '), '&lt;', '<'), '&gt;', '>'), '&quot;', '"'), '&amp;', '&'),
    '\s+', ' ', 'g')) AS t) s
$$;

CREATE OR REPLACE FUNCTION public.notify_on_assignment_published()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        public.notification_plain_text(NEW.description, 200),
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
        public.notification_plain_text(NEW.description, 200),
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
$function$

;
```

# Etapy A + B – finální návrh SQL (NIC NESPUŠTĚNO, jen návrh)

Ověřeno v databázi 7. 11. 2026. Etapa C (fronta) a přeposílání ztracených e-mailů se nepřipravují.

## 1. Současná těla funkcí (doslova)

### notify_on_assignment_published
```sql
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
  RETURN NEW;
END;
```

### notify_deadline_soon
```sql
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
    AND NOT public.is_preview_student(cm.user_id)
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

  -- Osobní úkoly (todos): termín zítra, nesplněné
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
```

## 2. Navržené CREATE OR REPLACE FUNCTION

Etapa A = větev pro skupiny (subject_group_members, bez preview žáků). Etapa B = nadpis podle settings.kind + payload.kind. Typ `assignment_new` se nemění, takže aplikace ani e-mailová šablona nespadnou; e-mailový text si druh stejně čte z settings.

```sql
CREATE OR REPLACE FUNCTION public.notify_on_assignment_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

```sql
CREATE OR REPLACE FUNCTION public.notify_deadline_soon()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

Poznámky k návrhu:
- Původní podpis (jazyk, SECURITY DEFINER, search_path) zůstane – před spuštěním ji ověřím `pg_get_function_identity_arguments` a případné odchylky uvedu.
- Duplicity nehrozí: úkol má buď třídu, nebo skupinu (dnes v datech nikdy obojí); `deadline_soon` navíc chrání stávající pojistka „max 1 notifikace / 20 h / úkol / žák“.
- Zpětné odeslání nehrozí: `notify_on_assignment_published` běží jen při přechodu na `published` (UPDATE s `OLD.status IS DISTINCT FROM`); `notify_deadline_soon` bere jen termíny v příštích 24 h.

## 3. Rollback (NESPOUŠTĚT)
Dva `CREATE OR REPLACE FUNCTION` s těly z bodu 1, doslova (uloženo i v tomto plánu výše).

## 4. Ověření po spuštění bez rozeslání e-mailů
1. `SELECT proname, prosrc FROM pg_proc WHERE proname IN (...)` – nové tělo je v databázi.
2. Pouze-čtecí simulace nad skutečným publikovaným úkolem skupiny: spustit vnitřní SELECT větve pro skupiny (bez INSERT) a spočítat, kolik žáků by upozornění dostalo.
3. Volitelný [TEST]: založit si vlastní testovací úkol ve vlastní [TEST] skupině, publikovat ho a zkontrolovat v `notifications`, že řádky vznikly se správným nadpisem a `payload.kind`. Testovací žáci mají smyšlené adresy (@demo.bezli.cz / preview), takže se žádný e-mail neodešle (send-email je přeskakuje) a v `email_log` se nic nepřidá. Po ověření [TEST] úkol a notifikace smažu (jen svoje data).
4. `SELECT` kontrola, že počet řádků v `email_log` se po testu nezměnil.

## 5. Kolik žáků ve skupinách by upozornění dostalo
- Žáků ve skupinách celkem (distinct): **90**, z toho 1 testovací (přeskakuje se).
- S povoleným e-mailem a reálnou adresou: **89** (zvoneček dostane všech 89 + ti s vypnutým e-mailem jen zvoneček).
- Rozdělení podle skupin (kolik členů má která) ověřím před spuštěním, pokud budete chtít.

## Na co se rozhodnout
- Schvalujete oba CREATE OR REPLACE přesně v této podobě? Po „schvaluji“ spustím jednu migraci, ověřím body 1–4 a napíšu výsledek. Nic se nenasadí ani neodešle žákům.

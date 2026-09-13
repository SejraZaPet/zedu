CREATE OR REPLACE FUNCTION public.notify_on_class_textbook_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _textbook_title text;
  _class_name text;
  _owner_id uuid;
  _actor uuid := COALESCE(NEW.added_by, '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  IF NEW.textbook_type = 'global' THEN
    SELECT label INTO _textbook_title FROM public.textbook_subjects WHERE id = NEW.textbook_id;
  ELSE
    SELECT title, teacher_id INTO _textbook_title, _owner_id
    FROM public.teacher_textbooks WHERE id = NEW.textbook_id;
  END IF;

  SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;

  -- Ochrana proti dvojité notifikaci při opakovaném přidání téže učebnice do téže třídy
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.type = 'class_textbook_added'
      AND n.payload->>'class_id' = NEW.class_id::text
      AND n.payload->>'textbook_id' = NEW.textbook_id::text
      AND n.created_at > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  -- Žáci třídy: pouze účty bez učitelské/adminské role, bez autora akce
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT
    cm.user_id,
    'class_textbook_added',
    'Nová učebnice ve třídě',
    'Učebnice „' || COALESCE(_textbook_title, '') || '" byla přidána do třídy ' || COALESCE(_class_name, '') || '.',
    jsonb_build_object('class_id', NEW.class_id, 'textbook_id', NEW.textbook_id, 'textbook_type', NEW.textbook_type),
    '/student/ucebnice'
  FROM public.class_members cm
  WHERE cm.class_id = NEW.class_id
    AND cm.user_id <> _actor
    AND NOT public.is_teaching_staff(cm.user_id);

  -- Učitelé třídy + vlastník učebnice, deduplikovaně, bez autora akce
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT DISTINCT
    r.user_id,
    'class_textbook_added',
    'Nová učebnice ve třídě',
    'Učebnice „' || COALESCE(_textbook_title, '') || '" byla přidána do třídy ' || COALESCE(_class_name, '') || '.',
    jsonb_build_object('class_id', NEW.class_id, 'textbook_id', NEW.textbook_id),
    '/ucitel/tridy'
  FROM (
    SELECT ct.user_id FROM public.class_teachers ct WHERE ct.class_id = NEW.class_id
    UNION
    SELECT _owner_id WHERE _owner_id IS NOT NULL
  ) r
  WHERE r.user_id IS NOT NULL
    AND r.user_id <> _actor;

  RETURN NEW;
END;
$function$;
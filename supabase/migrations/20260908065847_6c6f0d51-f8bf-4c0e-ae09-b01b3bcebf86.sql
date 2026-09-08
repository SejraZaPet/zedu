CREATE OR REPLACE FUNCTION public.claim_school_class_as_teacher(_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _caller_school uuid;
  _class_school uuid;
  _is_global_admin boolean;
  _has_teacher boolean;
  _new_role text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Nepřihlášený uživatel.';
  END IF;

  IF NOT public.is_teaching_staff(_caller) THEN
    RAISE EXCEPTION 'Tato akce je určena pouze učitelům.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _caller AND role = 'admin')
    INTO _is_global_admin;

  SELECT school_id INTO _caller_school FROM public.profiles WHERE id = _caller;
  SELECT school_id INTO _class_school FROM public.classes WHERE id = _class_id;

  IF NOT _is_global_admin AND (
    _class_school IS NULL OR _caller_school IS NULL OR _class_school <> _caller_school
  ) THEN
    RAISE EXCEPTION 'Tuto třídu nelze převzít – nepatří do vaší školy.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.class_teachers WHERE class_id = _class_id)
    INTO _has_teacher;

  _new_role := CASE WHEN _has_teacher THEN 'co_teacher' ELSE 'owner' END;

  INSERT INTO public.class_teachers (class_id, user_id, role)
  VALUES (_class_id, _caller, _new_role)
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_class_teacher_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _class_name text;
  _adder_name text;
BEGIN
  -- Vlastní akce (učitel si třídu přihlásil sám) - notifikaci neposílat.
  IF NEW.user_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  IF NEW.role = 'co_teacher' THEN
    SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;
    SELECT COALESCE(NULLIF(trim(concat_ws(' ', first_name, last_name)), ''), email)
      INTO _adder_name
      FROM public.profiles WHERE id = auth.uid();
    INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
    VALUES (
      NEW.user_id,
      'class_teacher_invited',
      'Přidán/a do třídy',
      COALESCE(_adder_name, 'Kolega') || ' vás přidal/a jako spoluučitele do třídy ' || COALESCE(_class_name, '') || '.',
      jsonb_build_object('class_id', NEW.class_id),
      '/ucitel/tridy'
    );
  END IF;
  RETURN NEW;
END;
$function$;
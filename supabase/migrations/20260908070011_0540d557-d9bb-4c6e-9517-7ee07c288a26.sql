DROP FUNCTION IF EXISTS public.claim_school_class_as_teacher(uuid);
CREATE FUNCTION public.claim_school_class_as_teacher(_class_id uuid)
RETURNS text
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
  _existing_role text;
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

  SELECT role INTO _existing_role FROM public.class_teachers
   WHERE class_id = _class_id AND user_id = _caller;
  IF _existing_role IS NOT NULL THEN
    RETURN _existing_role;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.class_teachers WHERE class_id = _class_id)
    INTO _has_teacher;

  _new_role := CASE WHEN _has_teacher THEN 'co_teacher' ELSE 'owner' END;

  INSERT INTO public.class_teachers (class_id, user_id, role)
  VALUES (_class_id, _caller, _new_role)
  ON CONFLICT DO NOTHING;

  RETURN _new_role;
END;
$function$;
GRANT EXECUTE ON FUNCTION public.claim_school_class_as_teacher(uuid) TO authenticated;
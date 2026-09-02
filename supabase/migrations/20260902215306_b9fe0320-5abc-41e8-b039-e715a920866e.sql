
-- Pomocná funkce: má uživatel roli učitele nebo vyšší?
CREATE OR REPLACE FUNCTION public.is_teaching_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('teacher', 'admin', 'school_admin', 'lektor')
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_teaching_staff(uuid) TO authenticated;

-- (1) Učitel smí VIDĚT třídy své školy (jen čtení základního seznamu).
CREATE POLICY "School teachers can read classes in own school"
ON public.classes
FOR SELECT
TO authenticated
USING (
  school_id IS NOT NULL
  AND school_id = public.get_user_school_id(auth.uid())
  AND public.is_teaching_staff(auth.uid())
);

-- (2) Učitel se přihlásí k výuce existující třídy své školy.
CREATE OR REPLACE FUNCTION public.claim_school_class_as_teacher(_class_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _caller_school uuid;
  _class_school uuid;
  _is_global_admin boolean;
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

  INSERT INTO public.class_teachers (class_id, user_id, role)
  VALUES (_class_id, _caller, 'co_teacher')
  ON CONFLICT DO NOTHING;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_school_class_as_teacher(uuid) TO authenticated;

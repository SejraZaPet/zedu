CREATE OR REPLACE FUNCTION public.link_parent_by_student_code(_code text)
RETURNS TABLE(id uuid, first_name text, last_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _parent uuid := auth.uid();
  _student record;
BEGIN
  IF _parent IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _parent AND role = 'rodic'::app_role
  ) THEN
    RAISE EXCEPTION 'Propojení dítěte může provést jen rodičovský účet';
  END IF;

  IF _code IS NULL OR length(btrim(_code)) < 4 THEN
    RAISE EXCEPTION 'Neplatný kód žáka';
  END IF;

  SELECT p.id, p.first_name, p.last_name
    INTO _student
  FROM public.profiles p
  WHERE p.student_code = btrim(_code)
  LIMIT 1;

  IF _student.id IS NULL THEN
    RAISE EXCEPTION 'Žák s tímto kódem neexistuje';
  END IF;

  IF _student.id = _parent THEN
    RAISE EXCEPTION 'Nelze propojit účet sám se sebou';
  END IF;

  INSERT INTO public.parent_student_links (parent_id, student_id)
  VALUES (_parent, _student.id)
  ON CONFLICT DO NOTHING;

  RETURN QUERY SELECT _student.id, _student.first_name, _student.last_name;
END;
$$;

REVOKE ALL ON FUNCTION public.link_parent_by_student_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_parent_by_student_code(text) TO authenticated;
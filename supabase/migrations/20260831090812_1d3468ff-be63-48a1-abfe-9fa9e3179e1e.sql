-- 1) parent_student_links: zrušit sebe-přiřazení rodiče
DROP POLICY IF EXISTS "Parents can link themselves to a student" ON public.parent_student_links;

-- Ověřený tok: rodič zná kód konkrétního žáka
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

-- 2) audit_log: zakázat libovolné klientské zápisy
DROP POLICY IF EXISTS "Users can insert audit entries as themselves" ON public.audit_log;

CREATE OR REPLACE FUNCTION public.log_audit_event(
  _action text,
  _target_type text DEFAULT NULL,
  _target_id uuid DEFAULT NULL,
  _details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _actor uuid := auth.uid();
BEGIN
  IF _actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.is_admin() OR public.is_school_admin(_actor) OR public.has_role(_actor, 'teacher')) THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění pro zápis do auditu';
  END IF;

  IF _action IS NULL OR length(btrim(_action)) = 0 OR length(_action) > 100 THEN
    RAISE EXCEPTION 'Neplatná akce';
  END IF;

  INSERT INTO public.audit_log (actor_id, action, target_type, target_id, details)
  VALUES (_actor, btrim(_action), left(_target_type, 100), _target_id, COALESCE(_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_audit_event(text, text, uuid, jsonb) TO authenticated;
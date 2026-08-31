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

  IF NOT (
    public.is_admin()
    OR public.is_school_admin(_actor)
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _actor AND role IN ('teacher'::app_role, 'lektor'::app_role)
    )
  ) THEN
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
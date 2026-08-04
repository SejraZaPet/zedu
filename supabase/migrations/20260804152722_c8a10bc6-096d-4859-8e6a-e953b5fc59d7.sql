CREATE OR REPLACE FUNCTION public.can_manage_credentials(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    _profile_id IS NOT NULL
    AND auth.uid() IS NOT NULL
    AND (
      _profile_id = auth.uid()
      OR public.is_admin()
      OR public.is_parent_of_student(_profile_id, auth.uid())
      OR public.is_teacher_of_student(_profile_id, auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = _profile_id
          AND p.school_id IS NOT NULL
          AND public.is_school_admin_of(p.school_id, auth.uid())
      )
    ),
    false
  )
$$;

CREATE OR REPLACE FUNCTION public.has_pin(_profile_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _target uuid := COALESCE(_profile_id, auth.uid());
BEGIN
  IF _uid IS NULL OR _target IS NULL THEN RETURN false; END IF;
  IF NOT COALESCE(
       _target = _uid OR public.is_admin() OR public.is_parent_of_student(_target, _uid),
       false
     ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profile_credentials WHERE profile_id = _target AND pin_hash IS NOT NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_manage_credentials(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_login_password(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_pin_for(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_pin(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_pin(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.can_manage_credentials(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_login_password(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_pin_for(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_pin(uuid) TO authenticated, service_role;
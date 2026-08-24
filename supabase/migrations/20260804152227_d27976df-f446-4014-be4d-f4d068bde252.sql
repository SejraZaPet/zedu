-- 1) PIN moves into the protected credentials table
ALTER TABLE public.profile_credentials ADD COLUMN IF NOT EXISTS pin_hash text;
ALTER TABLE public.profile_credentials ALTER COLUMN encrypted_password DROP NOT NULL;

INSERT INTO public.profile_credentials (profile_id, pin_hash, updated_at)
SELECT p.id, p.pin_code, now()
FROM public.profiles p
WHERE p.pin_code IS NOT NULL
ON CONFLICT (profile_id) DO UPDATE SET pin_hash = EXCLUDED.pin_hash;

-- 2) Authorization helper: who may manage a profile's credentials
CREATE OR REPLACE FUNCTION public.can_manage_credentials(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _profile_id IS NOT NULL AND (
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
  )
$$;

-- 3) Write password straight into the encrypted credentials table
CREATE OR REPLACE FUNCTION public.set_login_password(_profile_id uuid, _password text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF _password IS NULL OR length(_password) < 6 THEN
    RETURN json_build_object('error', 'Heslo musí mít alespoň 6 znaků');
  END IF;
  IF NOT public.can_manage_credentials(_profile_id) THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  INSERT INTO public.profile_credentials (profile_id, encrypted_password, updated_at)
  VALUES (
    _profile_id,
    extensions.pgp_sym_encrypt(_password, 'Bezli_CRED_KEY_1c5adfd16f82d83d2c08888bfd3a59870a12fba6f8809b7c'),
    now()
  )
  ON CONFLICT (profile_id) DO UPDATE
    SET encrypted_password = EXCLUDED.encrypted_password,
        updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

-- 4) PIN setters / verifiers now use profile_credentials.pin_hash
CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RETURN json_build_object('error', 'Nepřihlášený uživatel');
  END IF;
  IF _pin IS NULL OR length(_pin) != 4 OR _pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('error', 'PIN musí mít 4 číslice');
  END IF;

  INSERT INTO public.profile_credentials (profile_id, pin_hash, updated_at)
  VALUES (_uid, extensions.crypt(_pin, extensions.gen_salt('bf', 10)), now())
  ON CONFLICT (profile_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_user_pin_for(_profile_id uuid, _pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
BEGIN
  IF _pin IS NULL OR length(_pin) != 4 OR _pin !~ '^[0-9]{4}$' THEN
    RETURN json_build_object('error', 'PIN musí mít 4 číslice');
  END IF;
  IF NOT public.can_manage_credentials(_profile_id) THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  INSERT INTO public.profile_credentials (profile_id, pin_hash, updated_at)
  VALUES (_profile_id, extensions.crypt(_pin, extensions.gen_salt('bf', 10)), now())
  ON CONFLICT (profile_id) DO UPDATE
    SET pin_hash = EXCLUDED.pin_hash, updated_at = now();

  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.has_pin(_profile_id uuid DEFAULT NULL::uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target uuid := COALESCE(_profile_id, auth.uid());
BEGIN
  IF _target IS NULL THEN RETURN false; END IF;
  IF NOT (_target = auth.uid() OR public.is_admin() OR public.is_parent_of_student(_target, auth.uid())) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.profile_credentials WHERE profile_id = _target AND pin_hash IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_pin_login(_username text, _pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _profile record;
BEGIN
  IF _username IS NULL OR _pin IS NULL OR length(_pin) != 4 THEN
    RETURN json_build_object('error', 'Neplatné údaje');
  END IF;

  SELECT p.id, p.email, pc.pin_hash
  INTO _profile
  FROM public.profiles p
  LEFT JOIN public.profile_credentials pc ON pc.profile_id = p.id
  WHERE lower(p.username) = lower(trim(_username))
  LIMIT 1;

  IF _profile IS NULL OR _profile.pin_hash IS NULL THEN
    RETURN json_build_object('error', 'Uživatel nebo PIN nenalezen');
  END IF;

  IF _profile.pin_hash <> extensions.crypt(_pin, _profile.pin_hash) THEN
    RETURN json_build_object('error', 'Špatný PIN');
  END IF;

  RETURN json_build_object('email', _profile.email, 'user_id', _profile.id);
END;
$$;

-- 5) Drop the leaky columns and the write-through mailbox trigger
DROP TRIGGER IF EXISTS trg_sync_login_password ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_login_password_credential();
ALTER TABLE public.profiles DROP COLUMN IF EXISTS login_password;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS pin_code;

-- 6) Execute privileges
REVOKE ALL ON FUNCTION public.can_manage_credentials(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_login_password(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_pin(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_user_pin_for(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_pin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_pin_login(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.set_login_password(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_pin(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.set_user_pin_for(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_pin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_pin_login(text, text) TO anon, authenticated, service_role;
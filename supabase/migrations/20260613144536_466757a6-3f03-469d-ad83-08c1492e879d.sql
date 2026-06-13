CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.profile_credentials (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  encrypted_password BYTEA NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT ALL ON public.profile_credentials TO service_role;
-- No grants for anon/authenticated: access only via SECURITY DEFINER RPC below.

ALTER TABLE public.profile_credentials ENABLE ROW LEVEL SECURITY;

-- Deny-all policy (no policies => no client access). We add an explicit restrictive policy for clarity.
CREATE POLICY "no_client_access_profile_credentials"
  ON public.profile_credentials
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

CREATE OR REPLACE FUNCTION public.sync_login_password_credential()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.login_password IS NOT NULL AND NEW.login_password <> '' THEN
    INSERT INTO public.profile_credentials (profile_id, encrypted_password, updated_at)
    VALUES (
      NEW.id,
      extensions.pgp_sym_encrypt(NEW.login_password, 'ZEDU_CRED_KEY_1c5adfd16f82d83d2c08888bfd3a59870a12fba6f8809b7c'),
      now()
    )
    ON CONFLICT (profile_id) DO UPDATE
      SET encrypted_password = EXCLUDED.encrypted_password,
          updated_at = now();
    NEW.login_password := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_login_password ON public.profiles;
CREATE TRIGGER trg_sync_login_password
  BEFORE INSERT OR UPDATE OF login_password ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_login_password_credential();

CREATE OR REPLACE FUNCTION public.get_login_password(_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _result text;
BEGIN
  IF NOT (
    public.is_admin()
    OR public.is_school_admin(auth.uid())
    OR public.is_teacher_of_student(_profile_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Nedostatečná oprávnění';
  END IF;

  SELECT extensions.pgp_sym_decrypt(encrypted_password, 'ZEDU_CRED_KEY_1c5adfd16f82d83d2c08888bfd3a59870a12fba6f8809b7c')
  INTO _result
  FROM public.profile_credentials
  WHERE profile_id = _profile_id;

  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_login_password(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_login_password(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.has_login_credential(_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR public.is_school_admin(auth.uid())
    OR public.is_teacher_of_student(_profile_id, auth.uid())
  ) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.profile_credentials WHERE profile_id = _profile_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.has_login_credential(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_login_credential(uuid) TO authenticated;

-- Migrate existing plaintext passwords through the trigger
UPDATE public.profiles
SET login_password = login_password
WHERE login_password IS NOT NULL AND login_password <> '';
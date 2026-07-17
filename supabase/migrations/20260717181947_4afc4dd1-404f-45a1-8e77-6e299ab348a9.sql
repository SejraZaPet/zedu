
CREATE OR REPLACE FUNCTION public.get_internal_secret(_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  _v text;
BEGIN
  IF _name NOT IN ('notify_parent_internal_secret','send_push_internal_secret','cron_internal_secret') THEN
    RAISE EXCEPTION 'Unknown secret name';
  END IF;
  SELECT decrypted_secret INTO _v FROM vault.decrypted_secrets WHERE name = _name LIMIT 1;
  RETURN _v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_internal_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_internal_secret(text) FROM anon;
REVOKE ALL ON FUNCTION public.get_internal_secret(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_internal_secret(text) TO service_role;

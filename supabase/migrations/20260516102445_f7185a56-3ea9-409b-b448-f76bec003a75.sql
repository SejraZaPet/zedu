CREATE OR REPLACE FUNCTION public.verify_pin_login(_username text, _pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _profile record;
  _match boolean;
BEGIN
  IF _username IS NULL OR _pin IS NULL OR length(_pin) != 4 THEN
    RETURN json_build_object('error', 'Neplatné údaje');
  END IF;

  SELECT id, email, pin_code, login_password
  INTO _profile
  FROM public.profiles
  WHERE lower(username) = lower(trim(_username))
  LIMIT 1;

  IF _profile IS NULL OR _profile.pin_code IS NULL THEN
    RETURN json_build_object('error', 'Uživatel nebo PIN nenalezen');
  END IF;

  _match := (_profile.pin_code = extensions.crypt(_pin, _profile.pin_code));

  IF NOT _match THEN
    RETURN json_build_object('error', 'Špatný PIN');
  END IF;

  RETURN json_build_object(
    'email', _profile.email,
    'password', _profile.login_password,
    'user_id', _profile.id
  );
END;
$function$;
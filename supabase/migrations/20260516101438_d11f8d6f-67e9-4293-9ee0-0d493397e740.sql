CREATE OR REPLACE FUNCTION public.set_user_pin(_pin text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.profiles
  SET pin_code = extensions.crypt(_pin, extensions.gen_salt('bf', 10))
  WHERE id = _uid;

  RETURN json_build_object('success', true);
END;
$$;

UPDATE public.profiles
SET pin_code = extensions.crypt('9915', extensions.gen_salt('bf', 10))
WHERE username = 'mherink';
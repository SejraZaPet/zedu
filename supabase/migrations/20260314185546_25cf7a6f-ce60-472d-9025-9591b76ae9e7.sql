
-- Fix function search path
CREATE OR REPLACE FUNCTION public.generate_game_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  _code text;
  _exists boolean;
BEGIN
  LOOP
    _code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.game_sessions WHERE game_code = _code AND status != 'finished') INTO _exists;
    IF NOT _exists THEN
      RETURN _code;
    END IF;
  END LOOP;
END;
$$;

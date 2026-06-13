DROP POLICY IF EXISTS "Public can read exports" ON storage.objects;

DROP POLICY IF EXISTS "Authenticated can read published worksheets" ON public.worksheets;

REVOKE SELECT ON public.game_players FROM anon, authenticated;
GRANT SELECT (id, session_id, user_id, nickname, total_score, created_at) ON public.game_players TO anon, authenticated;

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

  SELECT id, email, pin_code
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
    'user_id', _profile.id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_access_realtime_topic(_topic text, _uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _session_id text;
BEGIN
  IF _topic IS NULL OR _uid IS NULL THEN
    RETURN false;
  END IF;

  IF _topic = 'notifications-' || _uid::text
     OR _topic = 'parent-messages-' || _uid::text
     OR _topic = 'teacher-parent-messages-' || _uid::text THEN
    RETURN true;
  END IF;

  IF _topic LIKE 'presenter-remote-%' THEN
    _session_id := replace(_topic, 'presenter-remote-', '');
    RETURN EXISTS (
      SELECT 1
      FROM public.game_sessions s
      WHERE s.id::text = _session_id
        AND s.teacher_id = _uid
    );
  END IF;

  IF _topic LIKE 'game-%' OR _topic LIKE 'poll-%' OR _topic LIKE 'wall-%' THEN
    _session_id := split_part(_topic, '-', 2);
    RETURN EXISTS (
      SELECT 1
      FROM public.game_sessions s
      WHERE s.id::text = _session_id
        AND s.teacher_id = _uid
    ) OR EXISTS (
      SELECT 1
      FROM public.game_players gp
      WHERE gp.session_id::text = _session_id
        AND gp.user_id = _uid
    );
  END IF;

  RETURN false;
END;
$function$;

DROP POLICY IF EXISTS "Authenticated can read allowed realtime topics" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can publish allowed realtime topics" ON realtime.messages;

CREATE POLICY "Authenticated can read allowed realtime topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (public.can_access_realtime_topic(topic, auth.uid()));

CREATE POLICY "Authenticated can publish allowed realtime topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (public.can_access_realtime_topic(topic, auth.uid()));
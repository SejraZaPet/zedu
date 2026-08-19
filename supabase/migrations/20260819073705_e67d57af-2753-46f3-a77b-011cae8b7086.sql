CREATE OR REPLACE FUNCTION public.set_game_whiteboard_slide_strokes(
  _session_id uuid,
  _slide_index integer,
  _strokes jsonb,
  _join_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _result jsonb;
BEGIN
  IF _slide_index < 0 OR jsonb_typeof(_strokes) <> 'array' THEN
    RAISE EXCEPTION 'Invalid whiteboard slide data';
  END IF;

  IF jsonb_array_length(_strokes) > 5000 THEN
    RAISE EXCEPTION 'Too many strokes';
  END IF;

  IF NOT public.is_game_session_participant(_session_id, _join_token) THEN
    RAISE EXCEPTION 'Not a participant of this game session';
  END IF;

  UPDATE public.game_sessions
  SET whiteboard_data = jsonb_build_object(
    'visible', COALESCE((whiteboard_data->>'visible')::boolean, false),
    'strokesBySlide', jsonb_set(
      CASE
        WHEN jsonb_typeof(whiteboard_data->'strokesBySlide') = 'object'
          THEN whiteboard_data->'strokesBySlide'
        WHEN jsonb_typeof(whiteboard_data->'strokes') = 'array'
             AND jsonb_array_length(whiteboard_data->'strokes') > 0
          THEN jsonb_build_object('0', whiteboard_data->'strokes')
        ELSE '{}'::jsonb
      END,
      ARRAY[_slide_index::text],
      _strokes,
      true
    )
  )
  WHERE id = _session_id
  RETURNING whiteboard_data INTO _result;

  RETURN _result;
END;
$function$;

REVOKE ALL ON FUNCTION public.set_game_whiteboard_slide_strokes(uuid, integer, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_game_whiteboard_slide_strokes(uuid, integer, jsonb, text) TO anon, authenticated, service_role;
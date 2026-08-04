CREATE OR REPLACE FUNCTION public.toggle_game_whiteboard(_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  UPDATE public.game_sessions
  SET whiteboard_data = jsonb_build_object(
    'visible', NOT COALESCE((whiteboard_data->>'visible')::boolean, false),
    'strokesBySlide', CASE
      WHEN jsonb_typeof(whiteboard_data->'strokesBySlide') = 'object'
        THEN whiteboard_data->'strokesBySlide'
      WHEN jsonb_typeof(whiteboard_data->'strokes') = 'array'
           AND jsonb_array_length(whiteboard_data->'strokes') > 0
        THEN jsonb_build_object('0', whiteboard_data->'strokes')
      ELSE '{}'::jsonb
    END
  )
  WHERE id = _session_id
  RETURNING whiteboard_data INTO _result;

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_game_whiteboard_slide_strokes(
  _session_id uuid,
  _slide_index integer,
  _strokes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
  IF _slide_index < 0 OR jsonb_typeof(_strokes) <> 'array' THEN
    RAISE EXCEPTION 'Invalid whiteboard slide data';
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
$$;

REVOKE ALL ON FUNCTION public.toggle_game_whiteboard(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_game_whiteboard_slide_strokes(uuid, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_game_whiteboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_game_whiteboard_slide_strokes(uuid, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_game_whiteboard(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_game_whiteboard_slide_strokes(uuid, integer, jsonb) TO service_role;
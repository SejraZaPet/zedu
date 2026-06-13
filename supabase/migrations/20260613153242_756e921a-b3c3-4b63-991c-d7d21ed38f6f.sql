
CREATE OR REPLACE FUNCTION public.strip_correct_flags(_data jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  _result jsonb;
  _elem jsonb;
  _new_elem jsonb;
  _new_answers jsonb;
  _a jsonb;
BEGIN
  IF _data IS NULL THEN RETURN NULL; END IF;
  IF jsonb_typeof(_data) <> 'array' THEN RETURN _data; END IF;

  _result := '[]'::jsonb;
  FOR _elem IN SELECT * FROM jsonb_array_elements(_data)
  LOOP
    IF jsonb_typeof(_elem) = 'object' AND _elem ? 'answers'
       AND jsonb_typeof(_elem->'answers') = 'array' THEN
      _new_answers := '[]'::jsonb;
      FOR _a IN SELECT * FROM jsonb_array_elements(_elem->'answers')
      LOOP
        IF jsonb_typeof(_a) = 'object' THEN
          _new_answers := _new_answers || jsonb_build_array((_a - 'correct') - 'isCorrect');
        ELSE
          _new_answers := _new_answers || jsonb_build_array(_a);
        END IF;
      END LOOP;
      _new_elem := jsonb_set(_elem, '{answers}', _new_answers, false);
      _result := _result || jsonb_build_array(_new_elem);
    ELSE
      _result := _result || jsonb_build_array(_elem);
    END IF;
  END LOOP;
  RETURN _result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.strip_correct_flags(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.strip_correct_flags(jsonb) TO anon, authenticated, service_role;

DROP VIEW IF EXISTS public.game_sessions_player_view;

CREATE VIEW public.game_sessions_player_view
WITH (security_invoker = true)
AS
SELECT
  gs.id,
  gs.teacher_id,
  gs.title,
  gs.game_code,
  gs.status,
  gs.settings,
  gs.current_question_index,
  gs.question_started_at,
  gs.created_at,
  gs.updated_at,
  gs.whiteboard_data,
  gs.teams,
  public.strip_correct_flags(gs.activity_data) AS activity_data_safe
FROM public.game_sessions gs;

GRANT SELECT ON public.game_sessions_player_view TO anon, authenticated;

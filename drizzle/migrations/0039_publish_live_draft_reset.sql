CREATE OR REPLACE FUNCTION public.publish_live_draft(_draft_id uuid, _position integer, _go_to boolean)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d public.live_session_drafts%ROWTYPE;
  s public.game_sessions%ROWTYPE;
  arr jsonb;
  cur integer;
  len integer;
  pos integer;
  new_arr jsonb := '[]'::jsonb;
  i integer;
BEGIN
  SELECT * INTO d FROM public.live_session_drafts WHERE id = _draft_id;
  IF NOT FOUND OR d.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'Koncept nenalezen'; END IF;
  SELECT * INTO s FROM public.game_sessions WHERE id = d.session_id FOR UPDATE;
  IF NOT FOUND OR s.teacher_id <> auth.uid() THEN RAISE EXCEPTION 'Nemáte oprávnění'; END IF;
  arr := COALESCE(s.activity_data, '[]'::jsonb);
  IF jsonb_typeof(arr) <> 'array' THEN arr := '[]'::jsonb; END IF;
  len := jsonb_array_length(arr);
  cur := COALESCE(s.current_question_index, -1);
  pos := COALESCE(_position, cur + 1);
  IF pos <= cur THEN pos := cur + 1; END IF;
  IF pos > len THEN pos := len; END IF;
  IF pos < 0 THEN pos := 0; END IF;
  FOR i IN 0..len LOOP
    IF i = pos THEN new_arr := new_arr || jsonb_build_array(d.slide); END IF;
    IF i < len THEN new_arr := new_arr || jsonb_build_array(arr -> i); END IF;
  END LOOP;
  IF _go_to THEN
    UPDATE public.game_sessions SET
      activity_data = new_arr,
      current_question_index = pos,
      question_started_at = now(),
      status = 'playing',
      zoom_state = NULL,
      settings = COALESCE(settings, '{}'::jsonb) || '{"projectorScrollTop":0,"revealStep":1}'::jsonb
    WHERE id = s.id;
  ELSE
    UPDATE public.game_sessions SET activity_data = new_arr WHERE id = s.id;
  END IF;
  DELETE FROM public.live_session_drafts WHERE id = d.id;
  RETURN pos;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.publish_live_draft(uuid, integer, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_live_draft(uuid, integer, boolean) TO authenticated;
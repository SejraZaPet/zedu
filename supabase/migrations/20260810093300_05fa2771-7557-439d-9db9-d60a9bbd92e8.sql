DROP FUNCTION public.get_player_session(uuid, text);
CREATE OR REPLACE FUNCTION public.get_player_session(_session_id uuid, _join_token text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, teacher_id uuid, title text, game_code text, status text, settings jsonb, current_question_index integer, question_started_at timestamp with time zone, created_at timestamp with time zone, updated_at timestamp with time zone, whiteboard_data jsonb, teams jsonb, zoom_state jsonb, activity_data_safe jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_game_session_participant(_session_id, _join_token) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.teacher_id, s.title, s.game_code, s.status, s.settings,
         s.current_question_index, s.question_started_at, s.created_at,
         s.updated_at, s.whiteboard_data, s.teams, s.zoom_state,
         public.strip_correct_flags(s.activity_data)
  FROM public.game_sessions s
  WHERE s.id = _session_id;
END;
$function$;
REVOKE ALL ON FUNCTION public.get_player_session(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_session(uuid, text) TO anon, authenticated, service_role;
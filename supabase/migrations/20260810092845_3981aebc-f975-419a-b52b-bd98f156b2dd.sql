DROP VIEW public.game_sessions_player_view;
CREATE VIEW public.game_sessions_player_view AS
SELECT id,
    teacher_id,
    title,
    game_code,
    status,
    settings,
    current_question_index,
    question_started_at,
    created_at,
    updated_at,
    whiteboard_data,
    teams,
    strip_correct_flags(activity_data) AS activity_data_safe,
    zoom_state
   FROM game_sessions gs;
GRANT SELECT ON public.game_sessions_player_view TO anon, authenticated;
GRANT ALL ON public.game_sessions_player_view TO service_role;
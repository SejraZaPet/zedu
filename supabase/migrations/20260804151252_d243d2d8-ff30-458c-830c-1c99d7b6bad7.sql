-- 1) game_sessions: require the requester to actually be the player
DROP POLICY IF EXISTS "Players can read sessions they joined" ON public.game_sessions;

CREATE POLICY "Players can read sessions they joined"
ON public.game_sessions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.session_id = game_sessions.id
      AND gp.user_id = auth.uid()
  )
);

-- 2) game_players: join_token must never come back through a normal SELECT
REVOKE SELECT (join_token) ON public.game_players FROM anon, authenticated;

-- 3) game_questions / game_question_votes: participants of that session only
DROP POLICY IF EXISTS "Anyone can read live questions" ON public.game_questions;
DROP POLICY IF EXISTS "Anyone can read question votes" ON public.game_question_votes;

CREATE POLICY "Session participants can read live questions"
ON public.game_questions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = game_questions.session_id AND s.teacher_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.game_players gp
    WHERE gp.session_id = game_questions.session_id AND gp.user_id = auth.uid()
  )
);

CREATE POLICY "Session participants can read question votes"
ON public.game_question_votes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.game_questions q
    WHERE q.id = game_question_votes.question_id
      AND (
        EXISTS (
          SELECT 1 FROM public.game_sessions s
          WHERE s.id = q.session_id AND s.teacher_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM public.game_players gp
          WHERE gp.session_id = q.session_id AND gp.user_id = auth.uid()
        )
      )
  )
);

-- Shared participant check (supports anonymous guests via join_token)
CREATE OR REPLACE FUNCTION public.is_game_session_participant(_session_id uuid, _join_token text DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT _session_id IS NOT NULL AND (
    EXISTS (
      SELECT 1 FROM public.game_sessions s
      WHERE s.id = _session_id AND s.teacher_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.game_players gp
      WHERE gp.session_id = _session_id AND gp.user_id = auth.uid()
    )
    OR (
      _join_token IS NOT NULL AND length(_join_token) >= 32 AND EXISTS (
        SELECT 1 FROM public.game_players gp
        WHERE gp.session_id = _session_id
          AND gp.join_token = _join_token
          AND (gp.token_expires_at IS NULL OR gp.token_expires_at > now())
      )
    )
  )
$$;

-- Safe session read for participants (mirrors game_sessions_player_view, no correct-answer flags)
CREATE OR REPLACE FUNCTION public.get_player_session(_session_id uuid, _join_token text DEFAULT NULL)
RETURNS TABLE(
  id uuid, teacher_id uuid, title text, game_code text, status text, settings jsonb,
  current_question_index integer, question_started_at timestamptz, created_at timestamptz,
  updated_at timestamptz, whiteboard_data jsonb, teams jsonb, activity_data_safe jsonb
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_game_session_participant(_session_id, _join_token) THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT s.id, s.teacher_id, s.title, s.game_code, s.status, s.settings,
         s.current_question_index, s.question_started_at, s.created_at,
         s.updated_at, s.whiteboard_data, s.teams,
         public.strip_correct_flags(s.activity_data)
  FROM public.game_sessions s
  WHERE s.id = _session_id;
END;
$$;

-- Live questions + votes for participants only
CREATE OR REPLACE FUNCTION public.get_session_questions(_session_id uuid, _join_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _q jsonb;
  _v jsonb;
BEGIN
  IF NOT public.is_game_session_participant(_session_id, _join_token) THEN
    RETURN jsonb_build_object('questions', '[]'::jsonb, 'votes', '[]'::jsonb);
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(q) ORDER BY q.created_at), '[]'::jsonb) INTO _q
  FROM public.game_questions q WHERE q.session_id = _session_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', v.id, 'question_id', v.question_id, 'player_id', v.player_id)), '[]'::jsonb) INTO _v
  FROM public.game_question_votes v
  JOIN public.game_questions q2 ON q2.id = v.question_id
  WHERE q2.session_id = _session_id;

  RETURN jsonb_build_object('questions', _q, 'votes', _v);
END;
$$;

-- 4) profiles: login_password / pin_code out of normal SELECT reach
REVOKE SELECT (login_password, pin_code) ON public.profiles FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.has_pin(_profile_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _target uuid := COALESCE(_profile_id, auth.uid());
BEGIN
  IF _target IS NULL THEN RETURN false; END IF;
  IF NOT (_target = auth.uid() OR public.is_admin() OR public.is_parent_of_student(_target, auth.uid())) THEN
    RETURN false;
  END IF;
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = _target AND pin_code IS NOT NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_game_session_participant(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_player_session(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_session_questions(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.has_pin(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_player_session(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_session_questions(uuid, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_pin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_game_session_participant(uuid, text) TO anon, authenticated, service_role;
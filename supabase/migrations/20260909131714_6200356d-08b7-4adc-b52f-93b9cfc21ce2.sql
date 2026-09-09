CREATE OR REPLACE FUNCTION public.get_activity_responses(
  _session_id uuid,
  _question_index integer,
  _join_token text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  player_id uuid,
  nickname text,
  answer jsonb,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ok boolean := false;
BEGIN
  IF _session_id IS NULL OR _question_index IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = _session_id AND s.teacher_id = auth.uid()
  ) INTO _ok;

  IF NOT _ok AND _join_token IS NOT NULL AND length(_join_token) >= 20 THEN
    SELECT EXISTS (
      SELECT 1 FROM public.game_players p
      WHERE p.session_id = _session_id
        AND p.join_token = _join_token
        AND (p.token_expires_at IS NULL OR p.token_expires_at > now())
    ) INTO _ok;
  END IF;

  IF NOT _ok THEN
    SELECT EXISTS (
      SELECT 1 FROM public.game_players p
      WHERE p.session_id = _session_id AND p.user_id = auth.uid()
    ) INTO _ok;
  END IF;

  IF NOT _ok THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT r.id, r.player_id, p.nickname, r.answer, r.created_at
  FROM public.game_responses r
  LEFT JOIN public.game_players p ON p.id = r.player_id
  WHERE r.session_id = _session_id
    AND r.question_index = _question_index
  ORDER BY r.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_activity_responses(uuid, integer, text) TO anon, authenticated;

ALTER TABLE public.game_players
  ADD COLUMN IF NOT EXISTS hand_raised boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hand_raised_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS student_index integer NULL;

-- Recreate public view with new columns
CREATE OR REPLACE VIEW public.game_players_public AS
SELECT id, session_id, user_id, nickname, total_score, created_at,
       hand_raised, hand_raised_at, student_index
FROM public.game_players;

GRANT SELECT ON public.game_players_public TO anon, authenticated;

-- Student raises/lowers own hand via join_token
CREATE OR REPLACE FUNCTION public.raise_hand(_join_token text, _raised boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_players
  SET hand_raised = _raised,
      hand_raised_at = CASE WHEN _raised THEN now() ELSE NULL END
  WHERE join_token = _join_token
    AND (token_expires_at IS NULL OR token_expires_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.raise_hand(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.raise_hand(text, boolean) TO anon, authenticated;

-- Student sets own student_index via join_token
CREATE OR REPLACE FUNCTION public.set_student_index(_join_token text, _index integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_players
  SET student_index = GREATEST(0, _index)
  WHERE join_token = _join_token
    AND (token_expires_at IS NULL OR token_expires_at > now());
END;
$$;

REVOKE ALL ON FUNCTION public.set_student_index(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_student_index(text, integer) TO anon, authenticated;

-- Teacher clears a player's raised hand
CREATE OR REPLACE FUNCTION public.clear_player_hand(_player_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
BEGIN
  SELECT session_id INTO _session_id FROM public.game_players WHERE id = _player_id;
  IF _session_id IS NULL THEN
    RAISE EXCEPTION 'player not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = _session_id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.game_players
  SET hand_raised = false, hand_raised_at = NULL
  WHERE id = _player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.clear_player_hand(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_player_hand(uuid) TO authenticated;

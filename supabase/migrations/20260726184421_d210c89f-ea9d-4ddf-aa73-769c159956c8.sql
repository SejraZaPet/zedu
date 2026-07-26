
-- game_questions
CREATE TABLE public.game_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  text text NOT NULL,
  answered boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX game_questions_session_idx ON public.game_questions(session_id, created_at DESC);

GRANT SELECT ON public.game_questions TO anon, authenticated;
GRANT ALL ON public.game_questions TO service_role;

ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read live questions"
  ON public.game_questions FOR SELECT
  USING (true);

-- No direct insert/update/delete policies — writes go through security-definer RPCs.

-- game_question_votes
CREATE TABLE public.game_question_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.game_questions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, player_id)
);

CREATE INDEX game_question_votes_q_idx ON public.game_question_votes(question_id);

GRANT SELECT ON public.game_question_votes TO anon, authenticated;
GRANT ALL ON public.game_question_votes TO service_role;

ALTER TABLE public.game_question_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read question votes"
  ON public.game_question_votes FOR SELECT
  USING (true);

-- Student submits a live question via join token
CREATE OR REPLACE FUNCTION public.submit_live_question(_join_token text, _text text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _player public.game_players%ROWTYPE;
  _clean text;
  _new_id uuid;
BEGIN
  _clean := btrim(_text);
  IF _clean IS NULL OR length(_clean) = 0 THEN
    RAISE EXCEPTION 'empty question';
  END IF;
  IF length(_clean) > 200 THEN
    _clean := substr(_clean, 1, 200);
  END IF;

  SELECT * INTO _player FROM public.game_players
  WHERE join_token = _join_token
    AND (token_expires_at IS NULL OR token_expires_at > now())
  LIMIT 1;
  IF _player.id IS NULL THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  INSERT INTO public.game_questions (session_id, player_id, text)
  VALUES (_player.session_id, _player.id, _clean)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_live_question(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_live_question(text, text) TO anon, authenticated;

-- Student toggles their vote for a question
CREATE OR REPLACE FUNCTION public.toggle_question_vote(_join_token text, _question_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _player public.game_players%ROWTYPE;
  _q_session uuid;
  _deleted int;
BEGIN
  SELECT * INTO _player FROM public.game_players
  WHERE join_token = _join_token
    AND (token_expires_at IS NULL OR token_expires_at > now())
  LIMIT 1;
  IF _player.id IS NULL THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  SELECT session_id INTO _q_session FROM public.game_questions WHERE id = _question_id;
  IF _q_session IS NULL OR _q_session <> _player.session_id THEN
    RAISE EXCEPTION 'question not in session';
  END IF;

  DELETE FROM public.game_question_votes
  WHERE question_id = _question_id AND player_id = _player.id;
  GET DIAGNOSTICS _deleted = ROW_COUNT;

  IF _deleted > 0 THEN
    RETURN false;
  END IF;

  INSERT INTO public.game_question_votes (question_id, player_id)
  VALUES (_question_id, _player.id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_question_vote(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.toggle_question_vote(text, uuid) TO anon, authenticated;

-- Teacher marks a question as answered/unanswered
CREATE OR REPLACE FUNCTION public.set_question_answered(_question_id uuid, _answered boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _session_id uuid;
BEGIN
  SELECT session_id INTO _session_id FROM public.game_questions WHERE id = _question_id;
  IF _session_id IS NULL THEN
    RAISE EXCEPTION 'question not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.game_sessions
    WHERE id = _session_id AND teacher_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  UPDATE public.game_questions SET answered = _answered WHERE id = _question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_question_answered(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_question_answered(uuid, boolean) TO authenticated;

-- Enable realtime replication for these tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_question_votes;

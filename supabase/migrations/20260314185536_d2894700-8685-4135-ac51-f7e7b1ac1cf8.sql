
-- Game sessions table
CREATE TABLE public.game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  title text NOT NULL DEFAULT '',
  game_code text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'lobby',
  activity_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  current_question_index integer NOT NULL DEFAULT -1,
  question_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Game players table
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES public.profiles(id),
  nickname text NOT NULL,
  total_score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Game responses table
CREATE TABLE public.game_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  question_index integer NOT NULL DEFAULT 0,
  answer jsonb NOT NULL DEFAULT '{}',
  is_correct boolean NOT NULL DEFAULT false,
  response_time_ms integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_responses ENABLE ROW LEVEL SECURITY;

-- game_sessions policies
CREATE POLICY "Teachers can create game sessions" ON public.game_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = teacher_id);
CREATE POLICY "Teachers can update own sessions" ON public.game_sessions FOR UPDATE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can delete own sessions" ON public.game_sessions FOR DELETE TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Teachers can read own sessions" ON public.game_sessions FOR SELECT TO authenticated USING (auth.uid() = teacher_id);
CREATE POLICY "Anyone can read session by code" ON public.game_sessions FOR SELECT USING (true);

-- game_players policies
CREATE POLICY "Anyone can join a game" ON public.game_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read players in a session" ON public.game_players FOR SELECT USING (true);
CREATE POLICY "Players can update own score" ON public.game_players FOR UPDATE USING (true);

-- game_responses policies
CREATE POLICY "Anyone can insert responses" ON public.game_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read responses" ON public.game_responses FOR SELECT USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_responses;

-- Generate unique game code function
CREATE OR REPLACE FUNCTION public.generate_game_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  _code text;
  _exists boolean;
BEGIN
  LOOP
    _code := upper(substring(md5(random()::text) from 1 for 6));
    SELECT EXISTS(SELECT 1 FROM public.game_sessions WHERE game_code = _code AND status != 'finished') INTO _exists;
    IF NOT _exists THEN
      RETURN _code;
    END IF;
  END LOOP;
END;
$$;

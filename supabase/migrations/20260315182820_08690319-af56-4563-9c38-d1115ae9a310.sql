
-- Add a join_token column to game_players for server-signed identity
ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS join_token text UNIQUE;
ALTER TABLE public.game_players ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

-- Create atomic score increment function to prevent race conditions
CREATE OR REPLACE FUNCTION public.increment_player_score(_player_id uuid, _score_delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_players
  SET total_score = total_score + _score_delta
  WHERE id = _player_id;
END;
$$;

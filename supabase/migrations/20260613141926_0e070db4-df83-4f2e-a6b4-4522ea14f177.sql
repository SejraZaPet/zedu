
-- 1. Public-safe view (excludes join_token and token_expires_at)
CREATE OR REPLACE VIEW public.game_players_public
WITH (security_invoker = true) AS
SELECT id, session_id, user_id, nickname, total_score, created_at
FROM public.game_players;

GRANT SELECT ON public.game_players_public TO anon, authenticated;

-- 2. Replace public SELECT policy on game_players with restricted access
DROP POLICY IF EXISTS "Anyone can read players in a session" ON public.game_players;

CREATE POLICY "Teachers and players read full row"
ON public.game_players
FOR SELECT
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.game_sessions s
    WHERE s.id = game_players.session_id AND s.teacher_id = auth.uid()
  )
);

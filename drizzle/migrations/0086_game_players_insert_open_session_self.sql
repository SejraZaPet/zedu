DROP POLICY IF EXISTS "Anyone can join a game" ON public.game_players;
CREATE POLICY "Join open session as self" ON public.game_players
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND join_token IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.game_sessions s
                WHERE s.id = game_players.session_id
                  AND s.status IN ('lobby','playing'))
  );
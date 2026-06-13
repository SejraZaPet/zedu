DROP POLICY IF EXISTS "Anyone can read session by code" ON public.game_sessions;

CREATE POLICY "Players can read sessions they joined"
ON public.game_sessions
FOR SELECT
USING (
  EXISTS (SELECT 1 FROM public.game_players gp WHERE gp.session_id = game_sessions.id)
);
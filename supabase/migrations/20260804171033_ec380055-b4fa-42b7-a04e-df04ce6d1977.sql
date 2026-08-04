CREATE OR REPLACE FUNCTION public.is_teacher_of_game_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT _session_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.game_sessions s
       WHERE s.id = _session_id AND s.teacher_id = auth.uid()
     );
$$;

CREATE OR REPLACE FUNCTION public.is_player_in_game_session(_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT _session_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.game_players gp
       WHERE gp.session_id = _session_id AND gp.user_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.is_teacher_of_game_session(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_player_in_game_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_teacher_of_game_session(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_player_in_game_session(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Teachers and players read full row" ON public.game_players;
CREATE POLICY "Teachers and players read full row"
ON public.game_players
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_teacher_of_game_session(session_id)
);

DROP POLICY IF EXISTS "Players can read sessions they joined" ON public.game_sessions;
CREATE POLICY "Players can read sessions they joined"
ON public.game_sessions
FOR SELECT
TO authenticated
USING (public.is_player_in_game_session(id));
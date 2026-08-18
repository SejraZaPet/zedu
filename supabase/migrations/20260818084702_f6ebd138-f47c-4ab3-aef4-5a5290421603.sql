GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

DROP POLICY IF EXISTS "Anyone can view active game backgrounds" ON public.game_backgrounds;

CREATE POLICY "Anon can view active game backgrounds"
ON public.game_backgrounds
FOR SELECT
TO anon
USING (is_active = true);

CREATE POLICY "Authenticated can view game backgrounds"
ON public.game_backgrounds
FOR SELECT
TO authenticated
USING (is_active = true OR public.is_admin());
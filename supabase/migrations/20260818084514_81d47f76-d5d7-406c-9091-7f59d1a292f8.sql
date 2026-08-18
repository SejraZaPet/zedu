GRANT SELECT ON public.game_backgrounds TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_backgrounds TO authenticated;
GRANT ALL ON public.game_backgrounds TO service_role;
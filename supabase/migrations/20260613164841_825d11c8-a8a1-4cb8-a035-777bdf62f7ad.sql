ALTER VIEW public.game_players_public SET (security_invoker = false);
GRANT SELECT ON public.game_players_public TO anon, authenticated;
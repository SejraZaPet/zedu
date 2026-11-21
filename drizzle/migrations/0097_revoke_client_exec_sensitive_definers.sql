REVOKE EXECUTE ON FUNCTION public.verify_pin_login(text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.creator_payout_target(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.demo_reset_seed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_pin_login(text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.creator_payout_target(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.demo_reset_seed() TO service_role;
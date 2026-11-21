-- NEAPLIKOVÁNO – čeká na schválení.
-- Čtecí RPC pro vlastní demo limity. Rozšiřitelné: další limity = další řádek v UNION.
CREATE OR REPLACE FUNCTION public.get_my_demo_limits()
RETURNS TABLE(key text, label text, used integer, "limit" integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); c public.demo_config;
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN; END IF;
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  RETURN QUERY SELECT 'ai'::text, 'AI generování'::text,
    (SELECT count(*)::int FROM public.demo_ai_usage u WHERE u.user_id = uid),
    c.ai_per_account;
END $$;
REVOKE ALL ON FUNCTION public.get_my_demo_limits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_demo_limits() TO authenticated;

-- NÁVRH KE SCHVÁLENÍ – NEAPLIKOVÁNO.
-- Jedna service-only konfigurace pro vytváření dem, AI, úložiště a budoucí limity.
-- Žádná změna stávajících tabulek ani oprávnění běžných účtů.
-- Obsahuje i get_my_demo_limits; při použití tohoto návrhu už neaplikovat starší demo_my_limits_rpc.sql.

CREATE TABLE public.demo_event_config (
  tag text PRIMARY KEY,
  active_from timestamptz NOT NULL,
  active_until timestamptz NOT NULL,
  create_per_ip_hour integer NOT NULL,
  create_global_day integer NOT NULL,
  ai_per_account integer NOT NULL,
  ai_daily_global integer NOT NULL,
  materials_max integer NOT NULL,
  live_players_max integer NOT NULL,
  upload_max_files integer NOT NULL,
  upload_max_bytes bigint NOT NULL,
  CHECK (active_until > active_from),
  CHECK (create_per_ip_hour > 0 AND create_global_day > 0),
  CHECK (ai_per_account > 0 AND ai_daily_global > 0),
  CHECK (materials_max > 0 AND live_players_max > 0),
  CHECK (upload_max_files > 0 AND upload_max_bytes > 0)
);
GRANT ALL ON public.demo_event_config TO service_role;
ALTER TABLE public.demo_event_config ENABLE ROW LEVEL SECURITY;
-- Záměrně žádná politika pro anon/authenticated: konfiguraci čte jen server.

INSERT INTO public.demo_event_config (
  tag, active_from, active_until,
  create_per_ip_hour, create_global_day,
  ai_per_account, ai_daily_global,
  materials_max, live_players_max, upload_max_files, upload_max_bytes
) VALUES (
  'dalkove-ucitele',
  '2026-11-21 00:00:00+01', -- začátek včetně, Praha
  '2026-12-15 00:00:00+01', -- konec výhradně: poslední den pro vytvoření je 14. 12. 2026
  150, 1000,
  15, 1000, -- 50 účastníků × 15 = 750; globálních 1000 ponechá prostor dalším demům
  50, 100, 50, 5242880 -- 2,5× běžných 20 / 40 / 20 / 2 MB
);

-- Jen pro zakládání nových dem: aktuální čas rozhoduje o zvýšených rate limitech.
CREATE OR REPLACE FUNCTION public.get_demo_creation_override(_tag text)
RETURNS TABLE (
  tag text, active_from timestamptz, active_until timestamptz,
  create_per_ip_hour integer, create_global_day integer,
  ai_per_account integer, ai_daily_global integer,
  materials_max integer, live_players_max integer,
  upload_max_files integer, upload_max_bytes bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.tag, c.active_from, c.active_until,
         c.create_per_ip_hour, c.create_global_day,
         c.ai_per_account, c.ai_daily_global,
         c.materials_max, c.live_players_max,
         c.upload_max_files, c.upload_max_bytes
  FROM public.demo_event_config c
  WHERE c.tag = _tag AND c.active_from <= now() AND c.active_until > now()
$$;
REVOKE ALL ON FUNCTION public.get_demo_creation_override(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_demo_creation_override(text) TO service_role;

-- Doživotní nárok existujícího dema: rozhoduje uložený štítek a created_at, nikdy aktuální datum.
-- Nové demo po skončení platnosti má stejný textový štítek, ale created_at už výjimku nesplní.
CREATE OR REPLACE FUNCTION public.demo_event_override_for_user(_user_id uuid)
RETURNS public.demo_event_config
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c
  FROM public.demo_pairs dp
  JOIN public.demo_event_config c
    ON c.tag = dp.event_tag
   AND dp.created_at >= c.active_from
   AND dp.created_at < c.active_until
  WHERE dp.teacher_user_id = _user_id OR dp.student_user_id = _user_id
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.demo_event_override_for_user(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_event_override_for_user(uuid) TO service_role;

-- AI rezervace zůstává atomická. Nárok se čte z demo_pairs, nikdy z argumentu klienta.
CREATE OR REPLACE FUNCTION public.demo_ai_reserve(_user_id uuid, _fn text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.demo_config;
  o public.demo_event_config;
  per_account integer;
  daily_global integer;
BEGIN
  IF NOT public.is_demo_user(_user_id) THEN RETURN true; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('demo_ai_usage'));
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  SELECT * INTO o FROM public.demo_event_override_for_user(_user_id);
  per_account := coalesce(o.ai_per_account, c.ai_per_account);
  daily_global := coalesce(o.ai_daily_global, c.ai_daily_global);
  IF (SELECT count(*) FROM public.demo_ai_usage WHERE user_id = _user_id) >= per_account THEN RETURN false; END IF;
  IF (SELECT count(*) FROM public.demo_ai_usage WHERE created_at >= date_trunc('day', now())) >= daily_global THEN RETURN false; END IF;
  INSERT INTO public.demo_ai_usage(user_id, function_name) VALUES (_user_id, left(coalesce(_fn,''),80));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.demo_ai_reserve(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.demo_ai_reserve(uuid, text) TO service_role;

-- Storage drží stejnou výjimku po celý život dema; běžná dema zůstávají na demo_config.
CREATE OR REPLACE FUNCTION public.demo_storage_upload_ok(_name text, _metadata jsonb)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, storage AS $$
DECLARE
  c public.demo_config;
  o public.demo_event_config;
  uid uuid := auth.uid();
  max_bytes bigint;
  max_files integer;
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN true; END IF;
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  SELECT * INTO o FROM public.demo_event_override_for_user(uid);
  max_bytes := coalesce(o.upload_max_bytes, c.upload_max_bytes);
  max_files := coalesce(o.upload_max_files, c.upload_max_files);
  IF lower(coalesce(_name,'')) !~ '\.(png|jpe?g|webp|pdf|docx|pptx|xlsx)$' THEN RETURN false; END IF;
  IF coalesce((_metadata->>'size')::bigint, (_metadata->>'contentLength')::bigint, 0) > max_bytes THEN RETURN false; END IF;
  IF coalesce(_metadata->>'mimetype','') ~* '^(video|audio)/' THEN RETURN false; END IF;
  IF (SELECT count(*) FROM storage.objects so WHERE so.owner = uid OR so.owner_id = uid::text) >= max_files THEN RETURN false; END IF;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.demo_storage_upload_ok(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.demo_storage_upload_ok(text, jsonb) TO authenticated, anon, service_role;

-- Čip ukazuje 15 i po skončení akce u dema vytvořeného během její platnosti.
CREATE OR REPLACE FUNCTION public.get_my_demo_limits()
RETURNS TABLE(key text, label text, used integer, "limit" integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  c public.demo_config;
  o public.demo_event_config;
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN; END IF;
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  SELECT * INTO o FROM public.demo_event_override_for_user(uid);
  RETURN QUERY SELECT 'ai'::text, 'AI generování'::text,
    (SELECT count(*)::int FROM public.demo_ai_usage u WHERE u.user_id = uid),
    coalesce(o.ai_per_account, c.ai_per_account);
END $$;
REVOKE ALL ON FUNCTION public.get_my_demo_limits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_demo_limits() TO authenticated;

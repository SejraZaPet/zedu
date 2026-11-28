-- NEAPLIKOVÁNO – čeká na výslovné schválení majitelky (návrh kvót počtu položek v demu).
-- Jen přidává: sloupec quotas, kontrolní funkci, triggery BEFORE INSERT a rozšíření get_my_demo_limits.
-- Ne-demo uživatelé: trigger skončí na prvním řádku (is_demo_user = false), jejich práva se nemění.
-- Stávající limity (soubory 20/2 MB, AI 25, vznik dema na IP, výjimky akcí) zůstávají beze změny.

ALTER TABLE public.demo_config
  ADD COLUMN IF NOT EXISTS quotas jsonb NOT NULL DEFAULT
  '{"textbooks":2,"lessons":10,"presentations":5,"worksheets":5,"activities":10,"assignments":10,"classes":2,"live_active":1,"live_total":10}'::jsonb;

CREATE OR REPLACE FUNCTION public.demo_quota_count(_uid uuid, _key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE _key
    WHEN 'textbooks'     THEN (SELECT count(*) FROM teacher_textbooks WHERE teacher_id = _uid)
    WHEN 'lessons'       THEN (SELECT count(*) FROM teacher_textbook_lessons l JOIN teacher_textbooks t ON t.id = l.textbook_id WHERE t.teacher_id = _uid)
    WHEN 'presentations' THEN (SELECT count(*) FROM teacher_presentations WHERE teacher_id = _uid)
    WHEN 'worksheets'    THEN (SELECT count(*) FROM worksheets WHERE teacher_id = _uid)
    WHEN 'activities'    THEN (SELECT count(*) FROM teacher_game_templates WHERE teacher_id = _uid AND demo_seed_key IS NULL)
    WHEN 'assignments'   THEN (SELECT count(*) FROM assignments WHERE teacher_id = _uid)
    WHEN 'classes'       THEN (SELECT count(*) FROM classes WHERE created_by = _uid) + (SELECT count(*) FROM subject_groups WHERE created_by = _uid)
    WHEN 'live_active'   THEN (SELECT count(*) FROM game_sessions WHERE teacher_id = _uid AND status IN ('waiting','playing'))
    WHEN 'live_total'    THEN (SELECT count(*) FROM game_sessions WHERE teacher_id = _uid)
  END::int
$$;

CREATE OR REPLACE FUNCTION public.demo_quota_limit(_uid uuid, _key text)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (c.quotas ->> _key)::int FROM demo_config c LIMIT 1
$$;

-- Trigger: TG_ARGV = klíče kvót. Chyba nese kód DEMO_QUOTA:<klíč>:<limit>, který frontend překládá.
CREATE OR REPLACE FUNCTION public.demo_quota_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); k text; lim int;
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN NEW; END IF;
  FOREACH k IN ARRAY TG_ARGV LOOP
    lim := public.demo_quota_limit(uid, k);
    IF lim IS NOT NULL AND public.demo_quota_count(uid, k) >= lim THEN
      RAISE EXCEPTION 'DEMO_QUOTA:%:%', k, lim USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.demo_quota_count(uuid, text), public.demo_quota_limit(uuid, text), public.demo_quota_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER demo_quota_textbooks     BEFORE INSERT ON public.teacher_textbooks        FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('textbooks');
CREATE TRIGGER demo_quota_lessons       BEFORE INSERT ON public.teacher_textbook_lessons FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('lessons');
CREATE TRIGGER demo_quota_presentations BEFORE INSERT ON public.teacher_presentations    FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('presentations');
CREATE TRIGGER demo_quota_worksheets    BEFORE INSERT ON public.worksheets               FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('worksheets');
CREATE TRIGGER demo_quota_activities    BEFORE INSERT ON public.teacher_game_templates   FOR EACH ROW WHEN (NEW.demo_seed_key IS NULL) EXECUTE FUNCTION public.demo_quota_guard('activities');
CREATE TRIGGER demo_quota_assignments   BEFORE INSERT ON public.assignments              FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('assignments');
CREATE TRIGGER demo_quota_classes       BEFORE INSERT ON public.classes                  FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('classes');
CREATE TRIGGER demo_quota_groups        BEFORE INSERT ON public.subject_groups           FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('classes');
CREATE TRIGGER demo_quota_live          BEFORE INSERT ON public.game_sessions            FOR EACH ROW EXECUTE FUNCTION public.demo_quota_guard('live_active','live_total');
-- Pozn.: seed dema (demo_seed_pair, service role) běží bez auth.uid() → kvóty ho neblokují.
-- Kopie učebnice s lekcemi: kopírovací kód musí předem ověřit, že se celá kopie vejde.

-- get_my_demo_limits: stávající řádek AI beze změny + kvóty (frontend je zobrazí jako „Učebnice 1/2“).
CREATE OR REPLACE FUNCTION public.get_my_demo_limits()
RETURNS TABLE(key text, label text, used integer, "limit" integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $function$
DECLARE uid uuid := auth.uid(); c public.demo_config; o public.demo_event_config;
BEGIN
  IF uid IS NULL OR NOT public.is_demo_user(uid) THEN RETURN; END IF;
  SELECT * INTO c FROM public.demo_config LIMIT 1;
  SELECT * INTO o FROM public.demo_event_override_for_user(uid);
  RETURN QUERY SELECT 'ai'::text, 'AI generování'::text,
    (SELECT count(*)::int FROM public.demo_ai_usage u WHERE u.user_id = uid),
    coalesce(o.ai_per_account, c.ai_per_account);
  RETURN QUERY SELECT q.key, q.label, public.demo_quota_count(uid, q.key), (c.quotas ->> q.key)::int
    FROM (VALUES ('textbooks','Učebnice',1),('lessons','Lekce',2),('presentations','Prezentace',3),
                 ('worksheets','Pracovní listy',4),('activities','Aktivity',5),('assignments','Úkoly',6),
                 ('classes','Třídy',7)) AS q(key,label,ord)
    WHERE c.quotas ? q.key ORDER BY q.ord;
END $function$;

-- ROLLBACK:
-- DROP TRIGGER demo_quota_textbooks ON public.teacher_textbooks; (… stejně pro ostatní triggery)
-- DROP FUNCTION public.demo_quota_guard(); DROP FUNCTION public.demo_quota_limit(uuid,text); DROP FUNCTION public.demo_quota_count(uuid,text);
-- get_my_demo_limits vrátit na verzi jen s řádkem 'ai'; sloupec quotas lze ponechat (neškodí).

-- NÁVRH KE SCHVÁLENÍ — NESPUŠTĚNO. Úklid záznamů chatu na webu a e-mailů.
-- Po schválení se spustí jako migrace; cron se vytvoří až po nasazení funkce log-retention-cleanup.

CREATE TABLE IF NOT EXISTS public.retention_config (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  website_chat_days integer NOT NULL DEFAULT 90 CHECK (website_chat_days >= 90),
  email_content_days integer NOT NULL DEFAULT 90 CHECK (email_content_days >= 90),
  email_row_days integer NOT NULL DEFAULT 365 CHECK (email_row_days >= 365),
  batch_size integer NOT NULL DEFAULT 5000 CHECK (batch_size BETWEEN 1 AND 50000),
  CHECK (email_row_days >= email_content_days)
);
REVOKE ALL ON public.retention_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.retention_config TO service_role;
ALTER TABLE public.retention_config ENABLE ROW LEVEL SECURITY;
-- bez pravidel: čte a mění jen service_role
INSERT INTO public.retention_config DEFAULT VALUES ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.run_log_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.retention_config;
  n_chat integer := 0;
  n_scrub integer := 0;
  n_email integer := 0;
BEGIN
  SELECT * INTO c FROM public.retention_config WHERE id;
  IF NOT FOUND THEN RAISE EXCEPTION 'retention_config missing'; END IF;

  -- 1) chat na webu: smazat starší než website_chat_days (min. 90)
  WITH d AS (
    SELECT id FROM public.website_chat_logs
    WHERE created_at < now() - make_interval(days => greatest(c.website_chat_days, 90))
    LIMIT c.batch_size
  )
  DELETE FROM public.website_chat_logs w USING d WHERE w.id = d.id;
  GET DIAGNOSTICS n_chat = ROW_COUNT;

  -- 2) e-maily: po email_content_days (min. 90) vymazat obsah; zůstane typ, stav, čas, příjemce
  WITH s AS (
    SELECT id FROM public.email_log
    WHERE created_at < now() - make_interval(days => greatest(c.email_content_days, 90))
      AND (subject <> '' OR html IS NOT NULL OR body_text IS NOT NULL
           OR error_message IS NOT NULL OR metadata <> '{}'::jsonb)
    LIMIT c.batch_size
  )
  UPDATE public.email_log e
     SET subject = '', html = NULL, body_text = NULL, error_message = NULL, metadata = '{}'::jsonb
    FROM s WHERE e.id = s.id;
  GET DIAGNOSTICS n_scrub = ROW_COUNT;

  -- 3) e-maily: řádky smazat po email_row_days (min. 365)
  WITH d AS (
    SELECT id FROM public.email_log
    WHERE created_at < now() - make_interval(days => greatest(c.email_row_days, 365))
    LIMIT c.batch_size
  )
  DELETE FROM public.email_log e USING d WHERE e.id = d.id;
  GET DIAGNOSTICS n_email = ROW_COUNT;

  RETURN jsonb_build_object('chat_deleted', n_chat, 'email_scrubbed', n_scrub, 'email_deleted', n_email);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_log_retention() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_log_retention() TO service_role;

-- ROLLBACK:
-- DROP FUNCTION IF EXISTS public.run_log_retention();
-- DROP TABLE IF EXISTS public.retention_config;

-- CRON (až po nasazení funkce, stejný mechanismus jako demo-cleanup, klíč z trezoru, týdně v neděli 3:30 UTC):
-- vytvoří se stejným pomocníkem/vzorem jako úloha demo-cleanup-nightly, s hlavičkou X-Cron-Secret
-- načtenou z vault secretu cron_internal_secret; žádná doslovná hodnota klíče.

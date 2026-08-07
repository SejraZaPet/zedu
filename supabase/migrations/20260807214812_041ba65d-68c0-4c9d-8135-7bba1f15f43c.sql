-- 1. marketplace_settings
CREATE TABLE public.marketplace_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  current_phase text NOT NULL DEFAULT 'founding',
  founding_commission_percent numeric NOT NULL DEFAULT 10,
  standard_commission_percent numeric NOT NULL DEFAULT 20,
  founding_threshold_type text NOT NULL DEFAULT 'active_schools',
  founding_threshold_value integer NOT NULL DEFAULT 50,
  founding_lock_years integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_settings TO authenticated;
GRANT ALL ON public.marketplace_settings TO service_role;
ALTER TABLE public.marketplace_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "marketplace_settings_select" ON public.marketplace_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "marketplace_settings_admin_all" ON public.marketplace_settings FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.marketplace_settings TO authenticated;
CREATE TRIGGER trg_marketplace_settings_updated_at BEFORE UPDATE ON public.marketplace_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.marketplace_settings (current_phase) VALUES ('founding');

-- 2. price / is_for_sale / commission_rate_locked
ALTER TABLE public.teacher_textbooks
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS is_for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rate_locked numeric;
ALTER TABLE public.worksheets
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS is_for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rate_locked numeric;
ALTER TABLE public.lesson_plans
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS is_for_sale boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commission_rate_locked numeric;

CREATE OR REPLACE FUNCTION public.marketplace_current_commission()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE WHEN s.current_phase = 'founding'
              THEN s.founding_commission_percent
              ELSE s.standard_commission_percent END
  FROM public.marketplace_settings s
  ORDER BY s.created_at LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tg_lock_commission_rate()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.is_for_sale IS TRUE AND NEW.commission_rate_locked IS NULL THEN
    NEW.commission_rate_locked := public.marketplace_current_commission();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lock_commission_textbooks BEFORE INSERT OR UPDATE OF is_for_sale ON public.teacher_textbooks FOR EACH ROW EXECUTE FUNCTION public.tg_lock_commission_rate();
CREATE TRIGGER trg_lock_commission_worksheets BEFORE INSERT OR UPDATE OF is_for_sale ON public.worksheets FOR EACH ROW EXECUTE FUNCTION public.tg_lock_commission_rate();
CREATE TRIGGER trg_lock_commission_lesson_plans BEFORE INSERT OR UPDATE OF is_for_sale ON public.lesson_plans FOR EACH ROW EXECUTE FUNCTION public.tg_lock_commission_rate();

-- 3. marketplace_subscriptions
CREATE TABLE public.marketplace_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL,
  subscriber_type text NOT NULL DEFAULT 'teacher',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  amount_paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_subscriptions TO authenticated;
GRANT ALL ON public.marketplace_subscriptions TO service_role;
ALTER TABLE public.marketplace_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ms_owner_select" ON public.marketplace_subscriptions FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (subscriber_type = 'teacher' AND subscriber_id = auth.uid())
    OR (subscriber_type = 'school' AND public.is_school_admin_of(subscriber_id, auth.uid()))
  );
CREATE POLICY "ms_admin_all" ON public.marketplace_subscriptions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER trg_marketplace_subscriptions_updated_at BEFORE UPDATE ON public.marketplace_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. marketplace_usage_events
CREATE TABLE public.marketplace_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.marketplace_subscriptions(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  content_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  event_type text NOT NULL,
  weight numeric NOT NULL DEFAULT 1,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mue_subscription_period ON public.marketplace_usage_events (subscription_id, occurred_at);
CREATE INDEX idx_mue_creator ON public.marketplace_usage_events (creator_id, occurred_at);
GRANT SELECT ON public.marketplace_usage_events TO authenticated;
GRANT ALL ON public.marketplace_usage_events TO service_role;
ALTER TABLE public.marketplace_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mue_admin_select" ON public.marketplace_usage_events FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "mue_admin_all" ON public.marketplace_usage_events FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.marketplace_usage_events TO authenticated;

CREATE OR REPLACE FUNCTION public.tg_marketplace_usage_default_weight()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.weight IS NULL OR NEW.weight = 1 THEN
    NEW.weight := CASE NEW.event_type
      WHEN 'added' THEN 1
      WHEN 'assigned_to_class' THEN 3
      WHEN 'live_session_started' THEN 5
      ELSE 1 END;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_mue_default_weight BEFORE INSERT ON public.marketplace_usage_events FOR EACH ROW EXECUTE FUNCTION public.tg_marketplace_usage_default_weight();

-- record usage event (system entry point)
CREATE OR REPLACE FUNCTION public.record_marketplace_usage(
  _subscription_id uuid, _content_type text, _content_id uuid, _creator_id uuid, _event_type text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'unauthorized'; END IF;
  INSERT INTO public.marketplace_usage_events (subscription_id, content_type, content_id, creator_id, event_type)
  VALUES (_subscription_id, _content_type, _content_id, _creator_id, _event_type)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- creator aggregate view of own usage
CREATE OR REPLACE FUNCTION public.creator_usage_summary(_period_month date DEFAULT NULL)
RETURNS TABLE(content_type text, event_type text, events_count bigint, weight_total numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT e.content_type, e.event_type, COUNT(*)::bigint, SUM(e.weight)
  FROM public.marketplace_usage_events e
  WHERE e.creator_id = auth.uid()
    AND (_period_month IS NULL OR (e.occurred_at >= _period_month AND e.occurred_at < (_period_month + interval '1 month')))
  GROUP BY e.content_type, e.event_type
$$;

-- 5. creator_earnings
CREATE TABLE public.creator_earnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  period_month date NOT NULL,
  source_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  paid_out boolean NOT NULL DEFAULT false,
  paid_out_at timestamptz
);
CREATE INDEX idx_creator_earnings_creator ON public.creator_earnings (creator_id, period_month);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_earnings TO authenticated;
GRANT ALL ON public.creator_earnings TO service_role;
ALTER TABLE public.creator_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ce_own_select" ON public.creator_earnings FOR SELECT TO authenticated
  USING (public.is_admin() OR creator_id = auth.uid());
CREATE POLICY "ce_admin_all" ON public.creator_earnings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 6. calculation
CREATE OR REPLACE FUNCTION public.calculate_subscription_shares(_subscription_id uuid, _period_month date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _amount numeric;
  _total_weight numeric;
  _std numeric;
  _rows integer := 0;
  _r record;
  _commission numeric;
  _net numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT amount_paid INTO _amount FROM public.marketplace_subscriptions WHERE id = _subscription_id;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;

  SELECT standard_commission_percent INTO _std FROM public.marketplace_settings ORDER BY created_at LIMIT 1;

  SELECT SUM(weight) INTO _total_weight
  FROM public.marketplace_usage_events
  WHERE subscription_id = _subscription_id
    AND occurred_at >= _period_month
    AND occurred_at < (_period_month + interval '1 month');

  IF _total_weight IS NULL OR _total_weight = 0 THEN RETURN 0; END IF;

  FOR _r IN
    SELECT e.creator_id,
           SUM(e.weight) AS w,
           -- vážený průměr uzamčené provize dle konkrétního obsahu
           SUM(e.weight * COALESCE(
             CASE e.content_type
               WHEN 'textbook' THEN (SELECT t.commission_rate_locked FROM public.teacher_textbooks t WHERE t.id = e.content_id)
               WHEN 'worksheet' THEN (SELECT w2.commission_rate_locked FROM public.worksheets w2 WHERE w2.id = e.content_id)
               WHEN 'lesson_plan' THEN (SELECT lp.commission_rate_locked FROM public.lesson_plans lp WHERE lp.id = e.content_id)
             END, _std)) / SUM(e.weight) AS avg_commission
    FROM public.marketplace_usage_events e
    WHERE e.subscription_id = _subscription_id
      AND e.occurred_at >= _period_month
      AND e.occurred_at < (_period_month + interval '1 month')
    GROUP BY e.creator_id
  LOOP
    _commission := COALESCE(_r.avg_commission, _std);
    _net := ROUND((_amount * (_r.w / _total_weight)) * (1 - _commission / 100.0), 2);

    INSERT INTO public.creator_earnings (creator_id, period_month, source_type, amount)
    VALUES (_r.creator_id, _period_month, 'subscription_share', _net);
    _rows := _rows + 1;
  END LOOP;

  RETURN _rows;
END;
$$;

CREATE OR REPLACE FUNCTION public.calculate_all_subscription_shares(_period_month date)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _s record; _total integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  FOR _s IN SELECT id FROM public.marketplace_subscriptions WHERE status = 'active' LOOP
    _total := _total + public.calculate_subscription_shares(_s.id, _period_month);
  END LOOP;
  RETURN _total;
END;
$$;

-- admin overview of marketplace metrics
CREATE OR REPLACE FUNCTION public.marketplace_phase_metrics()
RETURNS TABLE(active_schools integer, monthly_downloads integer, items_for_sale integer, active_subscriptions integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT COUNT(DISTINCT sl.school_id)::int FROM public.school_licenses sl
      WHERE sl.status IN ('active','trial') AND (sl.expires_at IS NULL OR sl.expires_at > now())),
    (SELECT (
        (SELECT COUNT(*) FROM public.teacher_textbooks t WHERE t.copied_from_textbook_id IS NOT NULL AND t.created_at > now() - interval '30 days')
      + (SELECT COUNT(*) FROM public.worksheets w WHERE w.copied_from_worksheet_id IS NOT NULL AND w.created_at > now() - interval '30 days')
      + (SELECT COUNT(*) FROM public.lesson_plans l WHERE l.copied_from_lesson_plan_id IS NOT NULL AND l.created_at > now() - interval '30 days')
    )::int),
    (SELECT (
        (SELECT COUNT(*) FROM public.teacher_textbooks t2 WHERE t2.is_for_sale)
      + (SELECT COUNT(*) FROM public.worksheets w2 WHERE w2.is_for_sale)
      + (SELECT COUNT(*) FROM public.lesson_plans l2 WHERE l2.is_for_sale)
    )::int),
    (SELECT COUNT(*)::int FROM public.marketplace_subscriptions WHERE status = 'active');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marketplace_current_commission() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_marketplace_usage(uuid, text, uuid, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.creator_usage_summary(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_subscription_shares(uuid, date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.calculate_all_subscription_shares(date) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.marketplace_phase_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.marketplace_current_commission() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_marketplace_usage(uuid, text, uuid, uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.creator_usage_summary(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_subscription_shares(uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_all_subscription_shares(date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.marketplace_phase_metrics() TO authenticated, service_role;
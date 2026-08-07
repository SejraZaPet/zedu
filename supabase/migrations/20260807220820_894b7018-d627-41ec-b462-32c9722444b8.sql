ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS allows_teacher_creators boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS creator_payout_recipient text NOT NULL DEFAULT 'school';

ALTER TABLE public.schools
  ADD CONSTRAINT schools_creator_payout_recipient_check
  CHECK (creator_payout_recipient IN ('teacher','school'));

ALTER TABLE public.creator_earnings
  ADD COLUMN IF NOT EXISTS payout_recipient_type text,
  ADD COLUMN IF NOT EXISTS payout_recipient_id uuid;

ALTER TABLE public.creator_earnings
  ADD CONSTRAINT creator_earnings_payout_recipient_type_check
  CHECK (payout_recipient_type IS NULL OR payout_recipient_type IN ('teacher','school'));

-- Helper: rozhodnutí školy o tvůrcích
CREATE OR REPLACE FUNCTION public.can_creator_sell(_creator_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN p.school_id IS NULL THEN true
    ELSE COALESCE((SELECT s.allows_teacher_creators FROM public.schools s WHERE s.id = p.school_id), false)
  END
  FROM public.profiles p
  WHERE p.id = _creator_id
$$;

CREATE OR REPLACE FUNCTION public.creator_payout_target(_creator_id uuid)
RETURNS TABLE(recipient_type text, recipient_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
           WHEN p.school_id IS NULL THEN 'teacher'
           ELSE COALESCE((SELECT s.creator_payout_recipient FROM public.schools s WHERE s.id = p.school_id), 'teacher')
         END AS recipient_type,
         CASE
           WHEN p.school_id IS NULL THEN p.id
           WHEN COALESCE((SELECT s.creator_payout_recipient FROM public.schools s WHERE s.id = p.school_id), 'teacher') = 'school'
             THEN p.school_id
           ELSE p.id
         END AS recipient_id
  FROM public.profiles p
  WHERE p.id = _creator_id
$$;

CREATE OR REPLACE FUNCTION public.tg_enforce_school_sale_permission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_for_sale IS TRUE
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.is_for_sale, false) IS DISTINCT FROM true)
     AND NEW.teacher_id IS NOT NULL
     AND NOT public.can_creator_sell(NEW.teacher_id) THEN
    RAISE EXCEPTION 'Vaše škola zatím neumožňuje prodej materiálů učitelů' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_school_sale_permission ON public.teacher_textbooks;
CREATE TRIGGER enforce_school_sale_permission
  BEFORE INSERT OR UPDATE OF is_for_sale ON public.teacher_textbooks
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_school_sale_permission();

DROP TRIGGER IF EXISTS enforce_school_sale_permission ON public.worksheets;
CREATE TRIGGER enforce_school_sale_permission
  BEFORE INSERT OR UPDATE OF is_for_sale ON public.worksheets
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_school_sale_permission();

DROP TRIGGER IF EXISTS enforce_school_sale_permission ON public.lesson_plans;
CREATE TRIGGER enforce_school_sale_permission
  BEFORE INSERT OR UPDATE OF is_for_sale ON public.lesson_plans
  FOR EACH ROW EXECUTE FUNCTION public.tg_enforce_school_sale_permission();

-- Doplnění příjemce výplaty do výpočtu podílů
CREATE OR REPLACE FUNCTION public.calculate_subscription_shares(_subscription_id uuid, _period_month date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _amount numeric;
  _total_weight numeric;
  _std numeric;
  _rows integer := 0;
  _r record;
  _commission numeric;
  _net numeric;
  _rt text;
  _rid uuid;
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

    SELECT t.recipient_type, t.recipient_id INTO _rt, _rid
    FROM public.creator_payout_target(_r.creator_id) t;

    INSERT INTO public.creator_earnings (creator_id, period_month, source_type, amount, payout_recipient_type, payout_recipient_id)
    VALUES (_r.creator_id, _period_month, 'subscription_share', _net, COALESCE(_rt, 'teacher'), COALESCE(_rid, _r.creator_id));
    _rows := _rows + 1;
  END LOOP;

  RETURN _rows;
END;
$function$;
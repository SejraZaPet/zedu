
-- 1. XP event log
CREATE TABLE public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'legacy',
  source_key text,
  base_amount integer NOT NULL DEFAULT 0,
  amount integer NOT NULL DEFAULT 0,
  day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Europe/Prague')::date),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX xp_events_user_day_idx ON public.xp_events(user_id, day);
CREATE INDEX xp_events_created_idx ON public.xp_events(created_at);
GRANT SELECT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own xp events" ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 2. Settings
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS league_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS league_name_mode text NOT NULL DEFAULT 'nickname';
ALTER TABLE public.schools ADD CONSTRAINT schools_league_name_mode_chk CHECK (league_name_mode IN ('nickname','initial'));
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS league_enabled boolean NOT NULL DEFAULT true;

-- 3-4. League tables (server-only)
CREATE TABLE public.league_opt_outs (user_id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.league_opt_outs TO service_role;
ALTER TABLE public.league_opt_outs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.league_memberships (user_id uuid PRIMARY KEY, tier smallint NOT NULL DEFAULT 0 CHECK (tier BETWEEN 0 AND 3), updated_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.league_memberships TO service_role;
ALTER TABLE public.league_memberships ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.league_weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL,
  school_id uuid NOT NULL,
  grade integer NOT NULL,
  tier smallint NOT NULL,
  group_no integer NOT NULL,
  user_id uuid NOT NULL,
  xp integer NOT NULL,
  rank integer NOT NULL,
  group_size integer NOT NULL,
  result text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_start, user_id)
);
GRANT ALL ON public.league_weeks TO service_role;
ALTER TABLE public.league_weeks ENABLE ROW LEVEL SECURITY;

-- 5. add_xp with source, diminishing repeats, daily cap, streak bonus
CREATE OR REPLACE FUNCTION public.add_xp(_student uuid, _amount integer, _source text, _source_key text)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _row public.student_xp;
  _today DATE := (now() AT TIME ZONE 'Europe/Prague')::date;
  _repeats INT := 0;
  _today_sum INT := 0;
  _today_cnt INT := 0;
  _factor NUMERIC := 1;
  _amt INT;
  _bonus INT := 0;
  _new_total INT; _new_level INT; _new_streak INT;
  _badges TEXT[] := ARRAY['xp_100','xp_500','xp_1000','xp_5000'];
  _thresholds INT[] := ARRAY[100,500,1000,5000];
  _i INT;
  _cap CONSTANT INT := 150;
BEGIN
  IF _student IS NULL OR _amount IS NULL OR _amount <= 0 THEN RETURN 0; END IF;

  INSERT INTO public.student_xp (student_id, total_xp, level, streak_days, last_activity_date)
  VALUES (_student, 0, 1, 0, NULL) ON CONFLICT (student_id) DO NOTHING;
  SELECT * INTO _row FROM public.student_xp WHERE student_id = _student FOR UPDATE;

  SELECT COALESCE(sum(amount),0), count(*) INTO _today_sum, _today_cnt
  FROM public.xp_events WHERE user_id = _student AND day = _today;

  IF _source_key IS NOT NULL THEN
    SELECT count(*) INTO _repeats FROM public.xp_events
    WHERE user_id = _student AND day = _today AND source = COALESCE(_source,'legacy') AND source_key = _source_key;
  END IF;
  _factor := CASE WHEN _repeats = 0 THEN 1 WHEN _repeats = 1 THEN 0.5 WHEN _repeats = 2 THEN 0.2 ELSE 0 END;

  IF _row.last_activity_date IS NULL THEN _new_streak := 1;
  ELSIF _row.last_activity_date = _today THEN _new_streak := GREATEST(_row.streak_days, 1);
  ELSIF _row.last_activity_date = _today - 1 THEN _new_streak := _row.streak_days + 1;
  ELSE _new_streak := 1; END IF;

  _amt := FLOOR(_amount * _factor);
  IF _today_cnt = 0 THEN
    _bonus := CASE WHEN _new_streak >= 7 THEN 10 WHEN _new_streak >= 3 THEN 5 ELSE 0 END;
  END IF;
  _amt := GREATEST(0, LEAST(_amt + _bonus, _cap - _today_sum));

  INSERT INTO public.xp_events (user_id, source, source_key, base_amount, amount, day)
  VALUES (_student, COALESCE(_source,'legacy'), _source_key, _amount, _amt, _today);

  _new_total := _row.total_xp + _amt;
  _new_level := floor(sqrt(_new_total::numeric / 50)) + 1;

  UPDATE public.student_xp SET total_xp = _new_total, level = _new_level, streak_days = _new_streak,
    last_activity_date = _today, updated_at = now() WHERE student_id = _student;

  FOR _i IN 1..array_length(_thresholds, 1) LOOP
    IF _new_total >= _thresholds[_i] THEN
      INSERT INTO public.student_badges (student_id, badge_slug) VALUES (_student, _badges[_i]) ON CONFLICT (student_id, badge_slug) DO NOTHING;
    END IF;
  END LOOP;
  IF _new_level >= 5 THEN INSERT INTO public.student_badges (student_id, badge_slug) VALUES (_student, 'level_5') ON CONFLICT DO NOTHING; END IF;
  IF _new_level >= 10 THEN INSERT INTO public.student_badges (student_id, badge_slug) VALUES (_student, 'level_10') ON CONFLICT DO NOTHING; END IF;
  IF _new_streak >= 7 THEN INSERT INTO public.student_badges (student_id, badge_slug) VALUES (_student, 'streak_7') ON CONFLICT DO NOTHING; END IF;
  IF _new_streak >= 30 THEN INSERT INTO public.student_badges (student_id, badge_slug) VALUES (_student, 'streak_30') ON CONFLICT DO NOTHING; END IF;
  RETURN _amt;
END;
$function$;

CREATE OR REPLACE FUNCTION public.add_xp(_student uuid, _amount integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN PERFORM public.add_xp(_student, _amount, 'legacy', NULL); END; $function$;

REVOKE EXECUTE ON FUNCTION public.add_xp(uuid, integer, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_xp(uuid, integer, text, text) TO service_role;

-- triggers pass source + key
CREATE OR REPLACE FUNCTION public.trg_add_xp_activity_result()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _ratio NUMERIC; _xp INT; _prev NUMERIC := 0;
BEGIN
  IF NEW.user_id IS NULL OR COALESCE(NEW.max_score, 0) <= 0 THEN RETURN NEW; END IF;
  _ratio := LEAST(1, GREATEST(0, COALESCE(NEW.score, 0)::numeric / NEW.max_score));
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.max_score, 0) > 0 THEN
    _prev := LEAST(1, GREATEST(0, COALESCE(OLD.score, 0)::numeric / OLD.max_score));
  END IF;
  _xp := FLOOR(GREATEST(0, _ratio - _prev) * 10);
  IF _xp > 0 THEN
    PERFORM public.add_xp(NEW.user_id, _xp, 'activity', COALESCE(NEW.lesson_id::text, NEW.source_lesson_id::text, '') || ':' || COALESCE(NEW.activity_index::text, ''));
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.trg_add_xp_assignment_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
  IF NEW.status = 'submitted' AND NEW.submitted_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.submitted_at IS NULL) AND NEW.student_id IS NOT NULL THEN
    PERFORM public.add_xp(NEW.student_id, 20, 'assignment', NEW.assignment_id::text);
  END IF; RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.trg_add_xp_lesson_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
  IF NEW.user_id IS NOT NULL THEN PERFORM public.add_xp(NEW.user_id, 15, 'lesson', NEW.lesson_id::text); END IF; RETURN NEW; END; $function$;

CREATE OR REPLACE FUNCTION public.trg_add_xp_practice_session()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$ BEGIN
  IF NEW.student_id IS NOT NULL THEN PERFORM public.add_xp(NEW.student_id, 10, 'practice', COALESCE(NEW.lesson_id::text, NEW.method_id::text)); END IF; RETURN NEW; END; $function$;

-- 6. League core
CREATE OR REPLACE FUNCTION public.league_week_start(_ts timestamptz DEFAULT now())
RETURNS date LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT date_trunc('week', (_ts AT TIME ZONE 'Europe/Prague'))::date $$;

CREATE OR REPLACE FUNCTION public.league_week_standings(_school uuid, _week date)
RETURNS TABLE(user_id uuid, grade integer, tier smallint, group_no integer, rank integer, group_size integer, xp integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH eligible AS (
    SELECT p.id AS user_id,
      (SELECT max(c.year) FROM public.class_members cm JOIN public.classes c ON c.id = cm.class_id
        WHERE cm.user_id = p.id AND c.school_id = _school) AS grade
    FROM public.profiles p
    JOIN public.schools s ON s.id = p.school_id AND s.league_enabled
    WHERE p.school_id = _school
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'user')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role <> 'user')
      AND NOT public.is_demo_user(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = p.id)
  ), base AS (
    SELECT e.user_id, e.grade, COALESCE(m.tier, 0)::smallint AS tier,
      COALESCE((SELECT sum(x.amount) FROM public.xp_events x WHERE x.user_id = e.user_id
         AND x.day >= _week AND x.day < _week + 7), 0)::int AS xp,
      row_number() OVER (PARTITION BY e.grade, COALESCE(m.tier,0) ORDER BY md5(e.user_id::text || _week::text)) AS seq
    FROM eligible e LEFT JOIN public.league_memberships m ON m.user_id = e.user_id
    WHERE e.grade IS NOT NULL
  ), grouped AS (
    SELECT b.*, ((b.seq - 1) / 30)::int AS group_no FROM base b
  )
  SELECT g.user_id, g.grade, g.tier, g.group_no,
    (row_number() OVER (PARTITION BY g.grade, g.tier, g.group_no ORDER BY g.xp DESC, g.user_id))::int AS rank,
    (count(*) OVER (PARTITION BY g.grade, g.tier, g.group_no))::int AS group_size,
    g.xp
  FROM grouped g
$$;
REVOKE EXECUTE ON FUNCTION public.league_week_standings(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.league_display_name(_user uuid, _mode text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT CASE WHEN _mode = 'initial'
    THEN NULLIF(trim(COALESCE(p.first_name,'') || ' ' || COALESCE(left(p.last_name,1) || '.', '')), '')
    ELSE NULLIF(p.username, '') END
  FROM public.profiles p WHERE p.id = _user
$$;
REVOKE EXECUTE ON FUNCTION public.league_display_name(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.school_league_week()
RETURNS TABLE(status text, rank integer, display_name text, avatar_user_id uuid, xp integer, is_me boolean, tier smallint, group_size integer, week_start date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _me uuid := auth.uid(); _school uuid; _enabled boolean; _mode text; _week date := public.league_week_start(); _my record;
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  IF public.is_demo_user(_me) THEN RETURN QUERY SELECT 'demo'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT p.school_id, s.league_enabled, s.league_name_mode INTO _school, _enabled, _mode
    FROM public.profiles p LEFT JOIN public.schools s ON s.id = p.school_id WHERE p.id = _me;
  IF _school IS NULL OR NOT COALESCE(_enabled,false) THEN
    RETURN QUERY SELECT 'disabled'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = _me) THEN
    RETURN QUERY SELECT 'opted_out'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  CREATE TEMP TABLE IF NOT EXISTS _lw ON COMMIT DROP AS SELECT * FROM public.league_week_standings(_school, _week);
  SELECT * INTO _my FROM _lw WHERE _lw.user_id = _me;
  IF _my IS NULL THEN
    RETURN QUERY SELECT 'no_grade'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  RETURN QUERY
    SELECT 'ok'::text, l.rank, COALESCE(public.league_display_name(l.user_id, _mode), 'Žák'),
      l.user_id, l.xp, l.user_id = _me, l.tier, l.group_size, _week
    FROM _lw l
    WHERE l.grade = _my.grade AND l.tier = _my.tier AND l.group_no = _my.group_no
      AND ((l.rank <= 10 AND l.xp > 0) OR l.user_id = _me)
    ORDER BY l.rank;
END; $$;
REVOKE EXECUTE ON FUNCTION public.school_league_week() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_league_week() TO authenticated;

CREATE OR REPLACE FUNCTION public.class_league_week()
RETURNS TABLE(rank integer, class_name text, avg_xp numeric, active_members integer, is_mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _me uuid := auth.uid(); _school uuid; _week date := public.league_week_start();
BEGIN
  IF _me IS NULL OR public.is_demo_user(_me) THEN RETURN; END IF;
  SELECT p.school_id INTO _school FROM public.profiles p JOIN public.schools s ON s.id = p.school_id AND s.league_enabled WHERE p.id = _me;
  IF _school IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH st AS (SELECT * FROM public.league_week_standings(_school, _week)),
  per AS (
    SELECT c.id, c.name, round(avg(st.xp)::numeric, 1) AS avg_xp, count(*)::int AS active,
      bool_or(cm.user_id = _me) AS mine
    FROM public.classes c
    JOIN public.class_members cm ON cm.class_id = c.id
    JOIN st ON st.user_id = cm.user_id AND st.xp > 0
    WHERE c.school_id = _school AND c.league_enabled
    GROUP BY c.id, c.name
  ), ranked AS (
    SELECT (row_number() OVER (ORDER BY per.avg_xp DESC, per.name))::int AS rk, per.* FROM per
  )
  SELECT r.rk, r.name, r.avg_xp, r.active, COALESCE(r.mine, false) FROM ranked r
  WHERE r.rk <= 10 OR EXISTS (SELECT 1 FROM public.class_members m WHERE m.class_id = r.id AND m.user_id = _me)
  ORDER BY r.rk;
END; $$;
REVOKE EXECUTE ON FUNCTION public.class_league_week() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_league_week() TO authenticated;

CREATE OR REPLACE FUNCTION public.set_league_opt_out(_opt_out boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF public.is_demo_user(_me) THEN RAISE EXCEPTION 'V ukázkovém režimu nelze měnit nastavení ligy.'; END IF;
  IF _opt_out THEN INSERT INTO public.league_opt_outs(user_id) VALUES (_me) ON CONFLICT DO NOTHING;
  ELSE DELETE FROM public.league_opt_outs WHERE user_id = _me; END IF;
  RETURN _opt_out;
END; $$;
REVOKE EXECUTE ON FUNCTION public.set_league_opt_out(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_league_opt_out(boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.close_league_week(_week date DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _w date := COALESCE(_week, public.league_week_start() - 7); _s record; _n int := 0; _r record; _res text;
BEGIN
  FOR _s IN SELECT id FROM public.schools WHERE league_enabled LOOP
    IF EXISTS (SELECT 1 FROM public.league_weeks WHERE week_start = _w AND school_id = _s.id) THEN CONTINUE; END IF;
    FOR _r IN SELECT * FROM public.league_week_standings(_s.id, _w) LOOP
      _res := 'stay';
      IF _r.rank <= 5 AND _r.xp > 0 AND _r.tier < 3 THEN _res := 'promoted';
      ELSIF _r.group_size >= 10 AND _r.rank > _r.group_size - 5 AND _r.tier > 0 THEN _res := 'demoted'; END IF;
      INSERT INTO public.league_weeks(week_start, school_id, grade, tier, group_no, user_id, xp, rank, group_size, result)
      VALUES (_w, _s.id, _r.grade, _r.tier, _r.group_no, _r.user_id, _r.xp, _r.rank, _r.group_size, _res)
      ON CONFLICT (week_start, user_id) DO NOTHING;
      IF _res <> 'stay' THEN
        INSERT INTO public.league_memberships(user_id, tier) VALUES (_r.user_id, _r.tier + CASE WHEN _res='promoted' THEN 1 ELSE -1 END)
        ON CONFLICT (user_id) DO UPDATE SET tier = EXCLUDED.tier, updated_at = now();
      END IF;
      IF _r.xp > 0 AND _r.rank <= 3 THEN
        INSERT INTO public.student_badges(student_id, badge_slug)
        VALUES (_r.user_id, CASE _r.rank WHEN 1 THEN 'league_gold' WHEN 2 THEN 'league_silver' ELSE 'league_bronze' END)
        ON CONFLICT DO NOTHING;
      END IF;
      _n := _n + 1;
    END LOOP;
  END LOOP;
  RETURN _n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.close_league_week(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.my_league_status()
RETURNS TABLE(opted_out boolean, tier smallint, school_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = auth.uid()),
    COALESCE((SELECT m.tier FROM public.league_memberships m WHERE m.user_id = auth.uid()), 0)::smallint,
    COALESCE((SELECT s.league_enabled FROM public.profiles p JOIN public.schools s ON s.id = p.school_id WHERE p.id = auth.uid()), false)
$$;
REVOKE EXECUTE ON FUNCTION public.my_league_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_league_status() TO authenticated;

-- 7. Cron: runs Sunday 22:05 and 23:05 UTC (= Monday 00:05 Prague in summer/winter); idempotent
SELECT cron.schedule('close-league-week', '5 22,23 * * 0', $$SELECT public.close_league_week()$$);

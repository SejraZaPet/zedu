
CREATE OR REPLACE FUNCTION public.school_league_week()
RETURNS TABLE(status text, rank integer, display_name text, avatar_user_id uuid, xp integer, is_me boolean, tier smallint, group_size integer, week_start date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE _me uuid := auth.uid(); _school uuid; _enabled boolean; _mode text; _week date := public.league_week_start();
  _g int; _t smallint; _gn int; _found boolean := false;
BEGIN
  IF _me IS NULL THEN RETURN; END IF;
  IF public.is_demo_user(_me) THEN RETURN QUERY SELECT 'demo'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT p.school_id, s.league_enabled, s.league_name_mode INTO _school, _enabled, _mode
    FROM public.profiles p LEFT JOIN public.schools s ON s.id = p.school_id WHERE p.id = _me;
  IF _school IS NULL OR NOT COALESCE(_enabled,false) THEN
    RETURN QUERY SELECT 'disabled'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  IF EXISTS (SELECT 1 FROM public.league_opt_outs o WHERE o.user_id = _me) THEN
    RETURN QUERY SELECT 'opted_out'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  SELECT l.grade, l.tier, l.group_no, true INTO _g, _t, _gn, _found
    FROM public.league_week_standings(_school, _week) l WHERE l.user_id = _me;
  IF NOT COALESCE(_found,false) THEN
    RETURN QUERY SELECT 'no_grade'::text, NULL::int, NULL::text, NULL::uuid, NULL::int, NULL::boolean, NULL::smallint, NULL::int, _week; RETURN; END IF;
  RETURN QUERY
    SELECT 'ok'::text, l.rank, COALESCE(public.league_display_name(l.user_id, _mode), 'Žák'),
      l.user_id, l.xp, l.user_id = _me, l.tier, l.group_size, _week
    FROM public.league_week_standings(_school, _week) l
    WHERE l.grade = _g AND l.tier = _t AND l.group_no = _gn
      AND ((l.rank <= 10 AND l.xp > 0) OR l.user_id = _me)
    ORDER BY l.rank;
END; $$;

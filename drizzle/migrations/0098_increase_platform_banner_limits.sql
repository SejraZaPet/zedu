CREATE OR REPLACE FUNCTION public.tg_banners_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  IF NOT public.is_admin() THEN
    IF TG_OP='UPDATE' AND NEW.hidden_by_admin IS DISTINCT FROM OLD.hidden_by_admin THEN
      RAISE EXCEPTION 'Skrytí banneru smí měnit jen správce platformy';
    END IF;
    IF TG_OP='UPDATE' AND (NEW.scope<>OLD.scope OR NEW.school_id IS DISTINCT FROM OLD.school_id) THEN
      RAISE EXCEPTION 'Banner nelze přesunout do jiné školy';
    END IF;
  ELSIF TG_OP='UPDATE' AND OLD.scope='school' AND auth.uid() IS NOT NULL
        AND (to_jsonb(NEW) - 'hidden_by_admin' - 'updated_at') <> (to_jsonb(OLD) - 'hidden_by_admin' - 'updated_at') THEN
    RAISE EXCEPTION 'Školní banner smí správce platformy jen skrýt';
  END IF;
  NEW.updated_at := now();
  IF NEW.is_active AND (NEW.ends_at IS NULL OR NEW.ends_at > now()) THEN
    PERFORM pg_advisory_xact_lock(hashtext('banners:'||NEW.scope||':'||coalesce(NEW.school_id::text,'-')));
    IF NEW.scope='school' THEN
      SELECT count(*) INTO n FROM public.banners
       WHERE scope='school' AND school_id=NEW.school_id AND is_active AND NOT hidden_by_admin
         AND (ends_at IS NULL OR ends_at > now()) AND id <> NEW.id;
      IF n >= 3 THEN RAISE EXCEPTION 'Škola může mít nejvýš 3 aktivní bannery'; END IF;
    ELSE
      IF NEW.target_students AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_students AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 6
        THEN RAISE EXCEPTION 'Žáci mohou mít nejvýš 6 aktivní platformové bannery'; END IF;
      IF NEW.target_teachers AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_teachers AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 6
        THEN RAISE EXCEPTION 'Učitelé mohou mít nejvýš 6 aktivní platformové bannery'; END IF;
      IF NEW.target_leadership AND (SELECT count(*) FROM public.banners WHERE scope='platform' AND is_active
           AND target_leadership AND (ends_at IS NULL OR ends_at>now()) AND id<>NEW.id) >= 6
        THEN RAISE EXCEPTION 'Vedení může mít nejvýš 6 aktivní platformové bannery'; END IF;
    END IF;
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.get_my_banners()
 RETURNS SETOF banners
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH me AS (
    SELECT public.get_user_school_id(auth.uid()) AS school_id,
      (EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='school_admin')
        OR COALESCE(public.is_school_leadership(public.get_user_school_id(auth.uid()), auth.uid()), false)) AS lead,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role IN ('teacher','lektor')) AS teach,
      EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role='user') AS stud
  ), live AS (
    SELECT b.*, row_number() OVER (PARTITION BY b.scope ORDER BY b.sort_order, b.created_at) rn
    FROM banners b, me
    WHERE auth.uid() IS NOT NULL AND b.is_active AND NOT b.hidden_by_admin
      AND (b.starts_at IS NULL OR b.starts_at <= now()) AND (b.ends_at IS NULL OR b.ends_at > now())
      AND (b.scope='platform' OR b.school_id = me.school_id)
      AND ((me.lead AND b.target_leadership) OR (me.teach AND b.target_teachers) OR (me.stud AND b.target_students))
  )
  SELECT id, scope, school_id, media_type, image_path, video_path, poster_path, alt_text, link_url,
         target_students, target_teachers, target_leadership, display_seconds, starts_at, ends_at,
         sort_order, is_active, hidden_by_admin, created_by, created_at, updated_at
  FROM live ORDER BY rn, (scope='school') LIMIT 9
$function$;
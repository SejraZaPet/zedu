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
  FROM live ORDER BY rn, (scope='school') LIMIT 6
$function$;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_view text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_view_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_preferred_view_check
  CHECK (preferred_view IS NULL OR preferred_view IN ('school_admin', 'teacher'));

CREATE OR REPLACE FUNCTION public.school_overview_stats(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.is_admin() OR public.is_school_admin_of(_school_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to view school overview';
  END IF;

  WITH school_users AS (
    SELECT p.id, p.status, u.last_sign_in_at
    FROM public.profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE p.school_id = _school_id
  ),
  roled AS (
    SELECT su.id, su.status, su.last_sign_in_at, ur.role::text AS role
    FROM school_users su
    JOIN public.user_roles ur ON ur.user_id = su.id
  ),
  role_counts AS (
    SELECT role,
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE last_sign_in_at > now() - interval '30 days')::int AS active_30d,
           COUNT(*) FILTER (WHERE last_sign_in_at IS NULL OR last_sign_in_at <= now() - interval '30 days')::int AS inactive_30d,
           COUNT(*) FILTER (WHERE status <> 'approved')::int AS not_approved
    FROM roled
    GROUP BY role
  )
  SELECT jsonb_build_object(
    'school_id', _school_id,
    'users_total', (SELECT COUNT(*)::int FROM school_users),
    'roles', COALESCE((
      SELECT jsonb_object_agg(role, jsonb_build_object(
        'total', total,
        'active_30d', active_30d,
        'inactive_30d', inactive_30d,
        'not_approved', not_approved
      )) FROM role_counts
    ), '{}'::jsonb),
    'signins', jsonb_build_object(
      'last_7d', (SELECT COUNT(*)::int FROM school_users WHERE last_sign_in_at > now() - interval '7 days'),
      'last_30d', (SELECT COUNT(*)::int FROM school_users WHERE last_sign_in_at > now() - interval '30 days'),
      'never', (SELECT COUNT(*)::int FROM school_users WHERE last_sign_in_at IS NULL)
    ),
    'license', (
      SELECT jsonb_build_object(
        'plan', l.plan,
        'status', l.status,
        'expires_at', l.expires_at,
        'seats_teachers', l.seats_teachers,
        'seats_students', l.seats_students,
        'teachers_used', (SELECT COUNT(DISTINCT r.id)::int FROM roled r WHERE r.role = 'teacher' AND r.status = 'approved'),
        'students_used', (SELECT COUNT(DISTINCT r.id)::int FROM roled r WHERE r.role = 'user' AND r.status = 'approved')
      )
      FROM public.school_licenses l
      WHERE l.school_id = _school_id
      ORDER BY l.created_at DESC
      LIMIT 1
    ),
    'activity', jsonb_build_object(
      'lesson_plans_7d', (SELECT COUNT(*)::int FROM public.lesson_plans lp JOIN school_users su ON su.id = lp.teacher_id WHERE lp.created_at > now() - interval '7 days'),
      'lesson_plans_30d', (SELECT COUNT(*)::int FROM public.lesson_plans lp JOIN school_users su ON su.id = lp.teacher_id WHERE lp.created_at > now() - interval '30 days'),
      'presentations_7d', (SELECT COUNT(*)::int FROM public.teacher_presentations tp JOIN school_users su ON su.id = tp.teacher_id WHERE tp.created_at > now() - interval '7 days'),
      'presentations_30d', (SELECT COUNT(*)::int FROM public.teacher_presentations tp JOIN school_users su ON su.id = tp.teacher_id WHERE tp.created_at > now() - interval '30 days'),
      'assignments_7d', (SELECT COUNT(*)::int FROM public.assignments a JOIN school_users su ON su.id = a.teacher_id WHERE a.created_at > now() - interval '7 days'),
      'assignments_30d', (SELECT COUNT(*)::int FROM public.assignments a JOIN school_users su ON su.id = a.teacher_id WHERE a.created_at > now() - interval '30 days'),
      'submissions_7d', (SELECT COUNT(*)::int FROM public.assignment_attempts at2 JOIN school_users su ON su.id = at2.student_id WHERE at2.submitted_at > now() - interval '7 days'),
      'submissions_30d', (SELECT COUNT(*)::int FROM public.assignment_attempts at2 JOIN school_users su ON su.id = at2.student_id WHERE at2.submitted_at > now() - interval '30 days'),
      'games_7d', (SELECT COUNT(*)::int FROM public.game_sessions gs JOIN school_users su ON su.id = gs.teacher_id WHERE gs.created_at > now() - interval '7 days'),
      'games_30d', (SELECT COUNT(*)::int FROM public.game_sessions gs JOIN school_users su ON su.id = gs.teacher_id WHERE gs.created_at > now() - interval '30 days'),
      'lessons_completed_30d', (SELECT COUNT(*)::int FROM public.student_lesson_completions slc JOIN school_users su ON su.id = slc.user_id WHERE slc.completed_at > now() - interval '30 days')
    ),
    'reservations', jsonb_build_object(
      'pending', (SELECT COUNT(*)::int FROM public.resource_reservations rr JOIN public.school_resources sr ON sr.id = rr.resource_id WHERE sr.school_id = _school_id AND rr.status = 'pending'),
      'upcoming_7d', (SELECT COUNT(*)::int FROM public.resource_reservations rr JOIN public.school_resources sr ON sr.id = rr.resource_id WHERE sr.school_id = _school_id AND rr.date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND rr.status <> 'rejected'),
      'resources_total', (SELECT COUNT(*)::int FROM public.school_resources WHERE school_id = _school_id AND is_active),
      'top_resources_week', COALESCE((
        SELECT jsonb_agg(t) FROM (
          SELECT sr.name, sr.type,
                 COUNT(*)::int AS reservations,
                 ROUND(SUM(EXTRACT(EPOCH FROM (rr.time_to - rr.time_from)) / 3600.0)::numeric, 1) AS hours
          FROM public.resource_reservations rr
          JOIN public.school_resources sr ON sr.id = rr.resource_id
          WHERE sr.school_id = _school_id
            AND rr.status <> 'rejected'
            AND rr.date BETWEEN CURRENT_DATE - 7 AND CURRENT_DATE + 7
          GROUP BY sr.id, sr.name, sr.type
          ORDER BY COUNT(*) DESC
          LIMIT 5
        ) t
      ), '[]'::jsonb)
    )
  ) INTO result;

  RETURN result;
END;
$function$;

REVOKE ALL ON FUNCTION public.school_overview_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.school_overview_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.school_overview_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.school_overview_stats(uuid) TO service_role;
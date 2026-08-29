
CREATE OR REPLACE FUNCTION public.can_view_class_engagement(_class_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin()
      OR public.is_class_owner(_class_id, _user_id)
      OR public.is_class_teacher(_class_id, _user_id)
      OR EXISTS (
           SELECT 1 FROM public.classes c
           WHERE c.id = _class_id
             AND c.school_id IS NOT NULL
             AND public.is_school_admin_of(c.school_id, _user_id)
         );
$$;

REVOKE ALL ON FUNCTION public.can_view_class_engagement(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_class_engagement(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.class_engagement_stats(_class_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.can_view_class_engagement(_class_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to view class engagement';
  END IF;

  WITH students AS (
    SELECT p.id, p.first_name, p.last_name, p.email, u.last_sign_in_at
    FROM public.class_members cm
    JOIN public.profiles p ON p.id = cm.user_id
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE cm.class_id = _class_id
  ),
  class_assignments AS (
    SELECT a.id, a.deadline
    FROM public.assignments a
    WHERE a.class_id = _class_id
      AND a.status = 'published'
  ),
  per_student AS (
    SELECT
      s.id,
      s.first_name,
      s.last_name,
      s.email,
      s.last_sign_in_at,
      (SELECT COUNT(*)::int FROM class_assignments) AS assigned_total,
      (SELECT COUNT(DISTINCT aa.assignment_id)::int
         FROM public.assignment_attempts aa
         JOIN class_assignments ca ON ca.id = aa.assignment_id
        WHERE aa.student_id = s.id AND aa.submitted_at IS NOT NULL) AS submitted_total,
      (SELECT COUNT(*)::int
         FROM class_assignments ca
        WHERE ca.deadline IS NOT NULL
          AND ca.deadline < now()
          AND NOT EXISTS (
            SELECT 1 FROM public.assignment_attempts aa
             WHERE aa.assignment_id = ca.id
               AND aa.student_id = s.id
               AND aa.submitted_at IS NOT NULL)) AS missed_total,
      (SELECT ROUND(AVG(aa.score::numeric / NULLIF(aa.max_score, 0)) * 100, 1)
         FROM public.assignment_attempts aa
         JOIN class_assignments ca ON ca.id = aa.assignment_id
        WHERE aa.student_id = s.id AND aa.submitted_at > now() - interval '30 days'
          AND aa.max_score > 0) AS avg_recent,
      (SELECT ROUND(AVG(aa.score::numeric / NULLIF(aa.max_score, 0)) * 100, 1)
         FROM public.assignment_attempts aa
         JOIN class_assignments ca ON ca.id = aa.assignment_id
        WHERE aa.student_id = s.id
          AND aa.submitted_at > now() - interval '60 days'
          AND aa.submitted_at <= now() - interval '30 days'
          AND aa.max_score > 0) AS avg_previous,
      (SELECT COUNT(*)::int FROM public.student_activity_results sar
        WHERE sar.user_id = s.id AND sar.completed_at > now() - interval '30 days') AS activities_30d,
      (SELECT COUNT(*)::int FROM public.student_lesson_completions slc
        WHERE slc.user_id = s.id AND slc.completed_at > now() - interval '30 days') AS lessons_30d,
      (SELECT COUNT(*)::int FROM public.behavior_points bp
        WHERE bp.student_id = s.id AND bp.class_id = _class_id
          AND bp.created_at > now() - interval '30 days') AS recognitions_30d
    FROM students s
  ),
  scored AS (
    SELECT
      ps.*,
      CASE WHEN ps.assigned_total > 0
           THEN ROUND(ps.submitted_total::numeric / ps.assigned_total * 100, 1)
           ELSE NULL END AS completion_rate,
      CASE
        WHEN ps.avg_recent IS NULL OR ps.avg_previous IS NULL THEN 'unknown'
        WHEN ps.avg_recent - ps.avg_previous <= -10 THEN 'down'
        WHEN ps.avg_recent - ps.avg_previous >= 10 THEN 'up'
        ELSE 'stable'
      END AS grade_trend,
      CASE
        WHEN ps.last_sign_in_at IS NULL THEN NULL
        ELSE EXTRACT(DAY FROM now() - ps.last_sign_in_at)::int
      END AS days_since_signin
    FROM per_student ps
  )
  SELECT jsonb_build_object(
    'class_id', _class_id,
    'generated_at', now(),
    'assignments_published', (SELECT COUNT(*)::int FROM class_assignments),
    'students', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', sc.id,
        'first_name', sc.first_name,
        'last_name', sc.last_name,
        'email', sc.email,
        'last_sign_in_at', sc.last_sign_in_at,
        'days_since_signin', sc.days_since_signin,
        'assigned_total', sc.assigned_total,
        'submitted_total', sc.submitted_total,
        'missed_total', sc.missed_total,
        'completion_rate', sc.completion_rate,
        'avg_recent', sc.avg_recent,
        'avg_previous', sc.avg_previous,
        'grade_trend', sc.grade_trend,
        'activities_30d', sc.activities_30d,
        'lessons_30d', sc.lessons_30d,
        'recognitions_30d', sc.recognitions_30d,
        'attention_reasons', (
          SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
            SELECT 'grades_down' AS r WHERE sc.grade_trend = 'down'
            UNION ALL
            SELECT 'low_completion' WHERE sc.completion_rate IS NOT NULL AND sc.completion_rate < 50 AND sc.assigned_total >= 2
            UNION ALL
            SELECT 'missed_assignments' WHERE sc.missed_total >= 3
            UNION ALL
            SELECT 'long_inactivity' WHERE sc.days_since_signin IS NULL OR sc.days_since_signin >= 14
          ) reasons
        ),
        'strength_reasons', (
          SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
            SELECT 'grades_up' AS r WHERE sc.grade_trend = 'up'
            UNION ALL
            SELECT 'high_completion' WHERE sc.completion_rate IS NOT NULL AND sc.completion_rate >= 90 AND sc.assigned_total >= 2
            UNION ALL
            SELECT 'high_activity' WHERE sc.activities_30d >= 10 OR sc.lessons_30d >= 10
            UNION ALL
            SELECT 'high_score' WHERE sc.avg_recent IS NOT NULL AND sc.avg_recent >= 85
          ) reasons
        )
      ) ORDER BY sc.last_name NULLS LAST, sc.first_name NULLS LAST)
      FROM scored sc
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.class_engagement_stats(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_engagement_stats(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.school_engagement_overview(_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT (public.is_admin() OR public.is_school_admin_of(_school_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized to view school engagement';
  END IF;

  WITH cls AS (
    SELECT c.id, c.name, c.year, c.field_of_study
    FROM public.classes c
    WHERE c.school_id = _school_id AND COALESCE(c.archived, false) = false
  ),
  members AS (
    SELECT cl.id AS class_id, cl.name, cl.year, cl.field_of_study,
           cm.user_id, u.last_sign_in_at
    FROM cls cl
    JOIN public.class_members cm ON cm.class_id = cl.id
    LEFT JOIN auth.users u ON u.id = cm.user_id
  ),
  assign AS (
    SELECT cl.id AS class_id, a.id AS assignment_id, a.deadline
    FROM cls cl
    JOIN public.assignments a ON a.class_id = cl.id AND a.status = 'published'
  ),
  per_class AS (
    SELECT
      cl.id AS class_id, cl.name, cl.year, cl.field_of_study,
      (SELECT COUNT(*)::int FROM members m WHERE m.class_id = cl.id) AS students,
      (SELECT COUNT(*)::int FROM members m WHERE m.class_id = cl.id
         AND m.last_sign_in_at > now() - interval '14 days') AS active_14d,
      (SELECT COUNT(*)::int FROM members m WHERE m.class_id = cl.id
         AND (m.last_sign_in_at IS NULL OR m.last_sign_in_at <= now() - interval '14 days')) AS inactive_14d,
      (SELECT COUNT(*)::int FROM assign a WHERE a.class_id = cl.id) AS assignments_published,
      (SELECT COUNT(*)::int
         FROM members m
         JOIN assign a ON a.class_id = m.class_id
        WHERE m.class_id = cl.id
          AND a.deadline IS NOT NULL AND a.deadline < now()
          AND NOT EXISTS (
            SELECT 1 FROM public.assignment_attempts aa
             WHERE aa.assignment_id = a.assignment_id
               AND aa.student_id = m.user_id
               AND aa.submitted_at IS NOT NULL)) AS missed_total,
      (SELECT ROUND(AVG(aa.score::numeric / NULLIF(aa.max_score, 0)) * 100, 1)
         FROM assign a
         JOIN public.assignment_attempts aa ON aa.assignment_id = a.assignment_id
        WHERE a.class_id = cl.id
          AND aa.submitted_at > now() - interval '30 days'
          AND aa.max_score > 0) AS avg_recent
    FROM cls cl
  )
  SELECT jsonb_build_object(
    'school_id', _school_id,
    'generated_at', now(),
    'classes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'class_id', pc.class_id,
        'name', pc.name,
        'year', pc.year,
        'field_of_study', pc.field_of_study,
        'students', pc.students,
        'active_14d', pc.active_14d,
        'inactive_14d', pc.inactive_14d,
        'assignments_published', pc.assignments_published,
        'missed_total', pc.missed_total,
        'avg_recent', pc.avg_recent
      ) ORDER BY pc.name)
      FROM per_class pc
    ), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.school_engagement_overview(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_engagement_overview(uuid) TO authenticated, service_role;

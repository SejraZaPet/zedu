CREATE OR REPLACE FUNCTION public.notify_on_class_story()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _class_name text;
  _preview text;
BEGIN
  SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;
  _preview := CASE
    WHEN length(NEW.text) > 140 THEN substr(NEW.text, 1, 140) || '…'
    ELSE NEW.text
  END;

  INSERT INTO public.notifications (
    recipient_id, sender_id, sender_role, type, title, body,
    payload, link, status, sent_at, is_manual
  )
  SELECT DISTINCT
    psl.parent_id,
    NEW.teacher_id,
    'teacher',
    'class_story_new',
    'Nový příspěvek ze třídy ' || COALESCE(_class_name, ''),
    COALESCE(_preview, ''),
    jsonb_build_object('class_id', NEW.class_id, 'story_id', NEW.id),
    '/rodic',
    'sent',
    now(),
    false
  FROM public.parent_student_links psl
  JOIN public.class_members cm ON cm.user_id = psl.student_id
  WHERE cm.class_id = NEW.class_id
    AND psl.parent_id <> NEW.teacher_id
    AND NOT public.is_preview_student(psl.student_id);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_on_class_textbook_added()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _textbook_title text;
  _class_name text;
  _owner_id uuid;
  _actor uuid := COALESCE(NEW.added_by, '00000000-0000-0000-0000-000000000000'::uuid);
BEGIN
  IF NEW.textbook_type = 'global' THEN
    SELECT label INTO _textbook_title FROM public.textbook_subjects WHERE id = NEW.textbook_id;
  ELSE
    SELECT title, teacher_id INTO _textbook_title, _owner_id
    FROM public.teacher_textbooks WHERE id = NEW.textbook_id;
  END IF;

  SELECT name INTO _class_name FROM public.classes WHERE id = NEW.class_id;

  -- Ochrana proti dvojité notifikaci při opakovaném přidání téže učebnice do téže třídy
  IF EXISTS (
    SELECT 1 FROM public.notifications n
    WHERE n.type = 'class_textbook_added'
      AND n.payload->>'class_id' = NEW.class_id::text
      AND n.payload->>'textbook_id' = NEW.textbook_id::text
      AND n.created_at > now() - interval '24 hours'
  ) THEN
    RETURN NEW;
  END IF;

  -- Žáci třídy: pouze účty bez učitelské/adminské role, bez autora akce
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT
    cm.user_id,
    'class_textbook_added',
    'Nová učebnice ve třídě',
    'Učebnice „' || COALESCE(_textbook_title, '') || '" byla přidána do třídy ' || COALESCE(_class_name, '') || '.',
    jsonb_build_object('class_id', NEW.class_id, 'textbook_id', NEW.textbook_id, 'textbook_type', NEW.textbook_type),
    '/student/ucebnice'
  FROM public.class_members cm
  WHERE cm.class_id = NEW.class_id
    AND cm.user_id <> _actor
    AND NOT public.is_teaching_staff(cm.user_id)
    AND NOT public.is_preview_student(cm.user_id);

  -- Učitelé třídy + vlastník učebnice, deduplikovaně, bez autora akce
  INSERT INTO public.notifications (recipient_id, type, title, body, payload, link)
  SELECT DISTINCT
    r.user_id,
    'class_textbook_added',
    'Nová učebnice ve třídě',
    'Učebnice „' || COALESCE(_textbook_title, '') || '" byla přidána do třídy ' || COALESCE(_class_name, '') || '.',
    jsonb_build_object('class_id', NEW.class_id, 'textbook_id', NEW.textbook_id),
    '/ucitel/tridy'
  FROM (
    SELECT ct.user_id FROM public.class_teachers ct WHERE ct.class_id = NEW.class_id
    UNION
    SELECT _owner_id WHERE _owner_id IS NOT NULL
  ) r
  WHERE r.user_id IS NOT NULL
    AND r.user_id <> _actor;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.class_engagement_stats(_class_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      AND NOT public.is_preview_student(cm.user_id)
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
$function$;

CREATE OR REPLACE FUNCTION public.school_engagement_overview(_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    WHERE NOT public.is_preview_student(cm.user_id)
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
          AND aa.max_score > 0
          AND NOT public.is_preview_student(aa.student_id)) AS avg_recent
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
$function$;

CREATE OR REPLACE FUNCTION public.school_overview_stats(_school_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
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
      AND NOT public.is_preview_student(p.id)
  ),
  -- Kanonická role: jedna role na uživatele podle priority.
  -- Žák = nemá žádnou zaměstnaneckou/rodičovskou roli.
  roled AS (
    SELECT su.id,
           su.status,
           su.last_sign_in_at,
           CASE
             WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = su.id AND r.role = 'admin') THEN 'admin'
             WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = su.id AND r.role = 'school_admin') THEN 'school_admin'
             WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = su.id AND r.role = 'teacher') THEN 'teacher'
             WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = su.id AND r.role = 'lektor') THEN 'lektor'
             WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = su.id AND r.role = 'rodic') THEN 'rodic'
             WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = su.id AND r.role = 'user') THEN 'user'
             ELSE NULL
           END AS role
    FROM school_users su
  ),
  role_counts AS (
    SELECT role,
           COUNT(DISTINCT id)::int AS total,
           COUNT(DISTINCT id) FILTER (WHERE last_sign_in_at > now() - interval '30 days')::int AS active_30d,
           COUNT(DISTINCT id) FILTER (WHERE last_sign_in_at IS NULL OR last_sign_in_at <= now() - interval '30 days')::int AS inactive_30d,
           COUNT(DISTINCT id) FILTER (WHERE status <> 'approved')::int AS not_approved
    FROM roled
    WHERE role IS NOT NULL
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
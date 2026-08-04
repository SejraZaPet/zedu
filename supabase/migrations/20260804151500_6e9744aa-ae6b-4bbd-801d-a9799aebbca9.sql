REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, first_name, last_name, email, school, field_of_study, year, status,
  created_at, updated_at, username, student_code, parent_email, school_id,
  parent_email_notifications, accessibility_settings)
ON public.profiles TO authenticated;

GRANT SELECT (id, first_name, last_name, username, student_code)
ON public.profiles TO anon;
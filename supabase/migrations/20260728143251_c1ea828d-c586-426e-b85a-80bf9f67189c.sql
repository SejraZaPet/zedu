
CREATE OR REPLACE FUNCTION public.verify_academy_certificate(_cert_number text)
RETURNS TABLE (
  certificate_number text,
  issued_at timestamptz,
  course_title text,
  course_audience text,
  recipient_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.certificate_number,
    c.issued_at,
    co.title AS course_title,
    co.audience AS course_audience,
    TRIM(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) AS recipient_name
  FROM public.academy_certificates c
  JOIN public.academy_enrollments e ON e.id = c.enrollment_id
  JOIN public.academy_courses co ON co.id = e.course_id
  LEFT JOIN public.profiles p ON p.id = e.teacher_id
  WHERE c.certificate_number = _cert_number
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_academy_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_academy_certificate(text) TO anon, authenticated;

-- 1) Extend academy_courses
ALTER TABLE public.academy_courses
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'teacher',
  ADD COLUMN IF NOT EXISTS issues_certificate boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS revenue_type text,
  ADD COLUMN IF NOT EXISTS creator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS platform_commission_percent numeric;

ALTER TABLE public.academy_courses DROP CONSTRAINT IF EXISTS academy_courses_audience_check;
ALTER TABLE public.academy_courses ADD CONSTRAINT academy_courses_audience_check
  CHECK (audience IN ('teacher','student','both'));

ALTER TABLE public.academy_courses DROP CONSTRAINT IF EXISTS academy_courses_revenue_type_check;
ALTER TABLE public.academy_courses ADD CONSTRAINT academy_courses_revenue_type_check
  CHECK (revenue_type IS NULL OR revenue_type IN ('Bezli','creator_share'));

-- 2) Certificate number sequence
CREATE SEQUENCE IF NOT EXISTS public.academy_certificate_seq START 1;

-- 3) academy_certificates table
CREATE TABLE IF NOT EXISTS public.academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.academy_enrollments(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  pdf_url text,
  UNIQUE (enrollment_id)
);

GRANT SELECT, INSERT, UPDATE ON public.academy_certificates TO authenticated;
GRANT ALL ON public.academy_certificates TO service_role;

ALTER TABLE public.academy_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own certificates" ON public.academy_certificates;
CREATE POLICY "Users view own certificates" ON public.academy_certificates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = academy_certificates.enrollment_id
        AND e.teacher_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins manage certificates" ON public.academy_certificates;
CREATE POLICY "Admins manage certificates" ON public.academy_certificates
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 4) Trigger to auto-create certificate row on completion
CREATE OR REPLACE FUNCTION public.tg_academy_issue_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues boolean;
  v_number text;
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    SELECT issues_certificate INTO v_issues
      FROM public.academy_courses WHERE id = NEW.course_id;
    IF v_issues THEN
      IF NOT EXISTS (SELECT 1 FROM public.academy_certificates WHERE enrollment_id = NEW.id) THEN
        v_number := 'Bezli-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.academy_certificate_seq')::text, 6, '0');
        INSERT INTO public.academy_certificates (enrollment_id, certificate_number)
          VALUES (NEW.id, v_number);
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academy_issue_certificate ON public.academy_enrollments;
CREATE TRIGGER trg_academy_issue_certificate
AFTER UPDATE ON public.academy_enrollments
FOR EACH ROW EXECUTE FUNCTION public.tg_academy_issue_certificate();

-- 5) Admin stats helper (uses user_roles directly since no has_role fn exists)
CREATE OR REPLACE FUNCTION public.academy_stats_by_course()
RETURNS TABLE (
  course_id uuid,
  course_title text,
  audience text,
  issues_certificate boolean,
  price numeric,
  revenue_type text,
  enrollments_count bigint,
  completions_count bigint,
  certificates_count bigint,
  teachers_completed bigint,
  students_completed bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.title,
    c.audience,
    c.issues_certificate,
    c.price,
    c.revenue_type,
    COUNT(DISTINCT e.id) AS enrollments_count,
    COUNT(DISTINCT e.id) FILTER (WHERE e.completed_at IS NOT NULL) AS completions_count,
    COUNT(DISTINCT cert.id) AS certificates_count,
    COUNT(DISTINCT e.teacher_id) FILTER (
      WHERE e.completed_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = e.teacher_id AND ur.role = 'teacher'::app_role
      )
    ) AS teachers_completed,
    COUNT(DISTINCT e.teacher_id) FILTER (
      WHERE e.completed_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = e.teacher_id AND ur.role = 'user'::app_role
      )
    ) AS students_completed
  FROM public.academy_courses c
  LEFT JOIN public.academy_enrollments e ON e.course_id = c.id
  LEFT JOIN public.academy_certificates cert ON cert.enrollment_id = e.id
  GROUP BY c.id, c.title, c.audience, c.issues_certificate, c.price, c.revenue_type, c.sort_order
  ORDER BY c.sort_order NULLS LAST, c.title;
$$;

REVOKE ALL ON FUNCTION public.academy_stats_by_course() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.academy_stats_by_course() TO authenticated;

-- Restrict stats to admins only via body guard
CREATE OR REPLACE FUNCTION public.academy_stats_by_course()
RETURNS TABLE (
  course_id uuid,
  course_title text,
  audience text,
  issues_certificate boolean,
  price numeric,
  revenue_type text,
  enrollments_count bigint,
  completions_count bigint,
  certificates_count bigint,
  teachers_completed bigint,
  students_completed bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    c.id, c.title, c.audience, c.issues_certificate, c.price, c.revenue_type,
    COUNT(DISTINCT e.id) AS enrollments_count,
    COUNT(DISTINCT e.id) FILTER (WHERE e.completed_at IS NOT NULL) AS completions_count,
    COUNT(DISTINCT cert.id) AS certificates_count,
    COUNT(DISTINCT e.teacher_id) FILTER (
      WHERE e.completed_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = e.teacher_id AND ur.role = 'teacher'::app_role
      )
    ) AS teachers_completed,
    COUNT(DISTINCT e.teacher_id) FILTER (
      WHERE e.completed_at IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_roles ur WHERE ur.user_id = e.teacher_id AND ur.role = 'user'::app_role
      )
    ) AS students_completed
  FROM public.academy_courses c
  LEFT JOIN public.academy_enrollments e ON e.course_id = c.id
  LEFT JOIN public.academy_certificates cert ON cert.enrollment_id = e.id
  GROUP BY c.id, c.title, c.audience, c.issues_certificate, c.price, c.revenue_type, c.sort_order
  ORDER BY c.sort_order NULLS LAST, c.title;
END;
$$;
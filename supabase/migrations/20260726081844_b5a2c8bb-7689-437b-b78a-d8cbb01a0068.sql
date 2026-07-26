
CREATE TABLE public.school_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'start',
  seats_teachers integer,
  seats_students integer,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'trial',
  billing_cycle text,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT school_licenses_plan_check CHECK (plan IN ('start','rust','skola','lektor')),
  CONSTRAINT school_licenses_status_check CHECK (status IN ('trial','active','expired')),
  CONSTRAINT school_licenses_billing_cycle_check CHECK (billing_cycle IS NULL OR billing_cycle IN ('monthly','yearly'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_licenses TO authenticated;
GRANT ALL ON public.school_licenses TO service_role;

ALTER TABLE public.school_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all school licenses"
  ON public.school_licenses FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "School admins view own school license"
  ON public.school_licenses FOR SELECT
  TO authenticated
  USING (public.is_school_admin_of(school_id, auth.uid()));

CREATE TRIGGER update_school_licenses_updated_at
  BEFORE UPDATE ON public.school_licenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Usage function: reports teachers and approved students per school.
CREATE OR REPLACE FUNCTION public.school_license_usage(_school_id uuid)
RETURNS TABLE(school_id uuid, teachers_used integer, students_used integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin() OR public.is_school_admin_of(_school_id, auth.uid())) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    _school_id,
    (SELECT COUNT(DISTINCT p.id)::int
       FROM public.profiles p
       JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = _school_id
        AND p.status = 'approved'
        AND ur.role IN ('teacher','lektor')),
    (SELECT COUNT(DISTINCT p.id)::int
       FROM public.profiles p
       JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE p.school_id = _school_id
        AND p.status = 'approved'
        AND ur.role = 'user');
END;
$$;

-- Admin-only bulk usage function for the admin overview table.
CREATE OR REPLACE FUNCTION public.school_license_usage_all()
RETURNS TABLE(school_id uuid, teachers_used integer, students_used integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    p.school_id,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role IN ('teacher','lektor'))::int,
    COUNT(DISTINCT p.id) FILTER (WHERE ur.role = 'user')::int
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.school_id IS NOT NULL
    AND p.status = 'approved'
  GROUP BY p.school_id;
END;
$$;

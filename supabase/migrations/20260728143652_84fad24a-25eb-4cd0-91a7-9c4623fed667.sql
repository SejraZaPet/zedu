-- 1) academy_pathways
CREATE TABLE public.academy_pathways (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_pathways TO authenticated;
GRANT SELECT ON public.academy_pathways TO anon;
GRANT ALL ON public.academy_pathways TO service_role;
ALTER TABLE public.academy_pathways ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published pathways" ON public.academy_pathways
  FOR SELECT USING (is_published = true OR public.is_admin());
CREATE POLICY "Admins manage pathways" ON public.academy_pathways
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER trg_academy_pathways_updated_at
BEFORE UPDATE ON public.academy_pathways
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) academy_pathway_courses
CREATE TABLE public.academy_pathway_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES public.academy_pathways(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES public.academy_courses(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pathway_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_pathway_courses TO authenticated;
GRANT SELECT ON public.academy_pathway_courses TO anon;
GRANT ALL ON public.academy_pathway_courses TO service_role;
ALTER TABLE public.academy_pathway_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read pathway courses" ON public.academy_pathway_courses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.academy_pathways p
            WHERE p.id = academy_pathway_courses.pathway_id
              AND (p.is_published = true OR public.is_admin()))
  );
CREATE POLICY "Admins manage pathway courses" ON public.academy_pathway_courses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_academy_pathway_courses_pathway ON public.academy_pathway_courses(pathway_id);
CREATE INDEX idx_academy_pathway_courses_course ON public.academy_pathway_courses(course_id);

-- 3) sequence + academy_pathway_certificates
CREATE SEQUENCE IF NOT EXISTS public.academy_pathway_certificate_seq;

CREATE TABLE public.academy_pathway_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pathway_id uuid NOT NULL REFERENCES public.academy_pathways(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  certificate_number text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pathway_id, teacher_id)
);
GRANT SELECT, INSERT ON public.academy_pathway_certificates TO authenticated;
GRANT ALL ON public.academy_pathway_certificates TO service_role;
ALTER TABLE public.academy_pathway_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads own pathway certs" ON public.academy_pathway_certificates
  FOR SELECT TO authenticated USING (teacher_id = auth.uid() OR public.is_admin());
CREATE POLICY "Admins manage pathway certs" ON public.academy_pathway_certificates
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX idx_pathway_certs_teacher ON public.academy_pathway_certificates(teacher_id);

-- 4) Auto-issue pathway certificates after a course cert is inserted
CREATE OR REPLACE FUNCTION public.tg_academy_issue_pathway_certs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
  v_course uuid;
  v_pathway record;
  v_number text;
BEGIN
  SELECT e.teacher_id, e.course_id INTO v_teacher, v_course
    FROM public.academy_enrollments e WHERE e.id = NEW.enrollment_id;

  IF v_teacher IS NULL OR v_course IS NULL THEN
    RETURN NEW;
  END IF;

  FOR v_pathway IN
    SELECT p.id
    FROM public.academy_pathways p
    JOIN public.academy_pathway_courses pc ON pc.pathway_id = p.id
    WHERE pc.course_id = v_course
  LOOP
    -- already issued?
    IF EXISTS (
      SELECT 1 FROM public.academy_pathway_certificates
      WHERE pathway_id = v_pathway.id AND teacher_id = v_teacher
    ) THEN
      CONTINUE;
    END IF;

    -- all courses in this pathway have a certificate for this teacher?
    IF NOT EXISTS (
      SELECT 1
      FROM public.academy_pathway_courses pc2
      WHERE pc2.pathway_id = v_pathway.id
        AND NOT EXISTS (
          SELECT 1
          FROM public.academy_enrollments e2
          JOIN public.academy_certificates c2 ON c2.enrollment_id = e2.id
          WHERE e2.teacher_id = v_teacher
            AND e2.course_id = pc2.course_id
        )
    ) THEN
      v_number := 'Bezli-PATHWAY-' || to_char(now(), 'YYYY') || '-' ||
                  lpad(nextval('public.academy_pathway_certificate_seq')::text, 6, '0');
      INSERT INTO public.academy_pathway_certificates (pathway_id, teacher_id, certificate_number)
        VALUES (v_pathway.id, v_teacher, v_number);
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academy_issue_pathway_certs ON public.academy_certificates;
CREATE TRIGGER trg_academy_issue_pathway_certs
AFTER INSERT ON public.academy_certificates
FOR EACH ROW EXECUTE FUNCTION public.tg_academy_issue_pathway_certs();

-- 5) Extend verify_academy_certificate to support pathway certs
CREATE OR REPLACE FUNCTION public.verify_academy_certificate(_cert_number text)
RETURNS TABLE(
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
    COALESCE(NULLIF(TRIM(p.first_name || ' ' || COALESCE(p.last_name, '')), ''), p.email) AS recipient_name
  FROM public.academy_certificates c
  JOIN public.academy_enrollments e ON e.id = c.enrollment_id
  JOIN public.academy_courses co ON co.id = e.course_id
  LEFT JOIN public.profiles p ON p.id = e.teacher_id
  WHERE c.certificate_number = _cert_number
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.verify_academy_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_academy_certificate(text) TO anon, authenticated;

-- New: public verification for pathway certificates
CREATE OR REPLACE FUNCTION public.verify_academy_pathway_certificate(_cert_number text)
RETURNS TABLE(
  certificate_number text,
  issued_at timestamptz,
  pathway_title text,
  pathway_description text,
  recipient_name text,
  courses jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    pc.certificate_number,
    pc.issued_at,
    p.title AS pathway_title,
    p.description AS pathway_description,
    COALESCE(NULLIF(TRIM(pr.first_name || ' ' || COALESCE(pr.last_name, '')), ''), pr.email) AS recipient_name,
    COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', co.id, 'title', co.title, 'sort_order', apc.sort_order)
                       ORDER BY apc.sort_order, co.title)
      FROM public.academy_pathway_courses apc
      JOIN public.academy_courses co ON co.id = apc.course_id
      WHERE apc.pathway_id = p.id
    ), '[]'::jsonb) AS courses
  FROM public.academy_pathway_certificates pc
  JOIN public.academy_pathways p ON p.id = pc.pathway_id
  LEFT JOIN public.profiles pr ON pr.id = pc.teacher_id
  WHERE pc.certificate_number = _cert_number
  LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.verify_academy_pathway_certificate(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_academy_pathway_certificate(text) TO anon, authenticated;

ALTER TABLE public.academy_courses
  ADD COLUMN IF NOT EXISTS requires_evidence boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.academy_evidence_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.academy_enrollments(id) ON DELETE CASCADE,
  description text NOT NULL,
  file_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  reviewer_id uuid REFERENCES public.profiles(id),
  reviewer_comment text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academy_evidence_status_chk CHECK (status IN ('pending','approved','rejected'))
);

CREATE INDEX IF NOT EXISTS idx_academy_evidence_enrollment ON public.academy_evidence_submissions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_academy_evidence_status ON public.academy_evidence_submissions(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.academy_evidence_submissions TO authenticated;
GRANT ALL ON public.academy_evidence_submissions TO service_role;

ALTER TABLE public.academy_evidence_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Teachers view own evidence" ON public.academy_evidence_submissions;
CREATE POLICY "Teachers view own evidence" ON public.academy_evidence_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = academy_evidence_submissions.enrollment_id
        AND e.teacher_id = auth.uid()
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Teachers insert own evidence" ON public.academy_evidence_submissions;
CREATE POLICY "Teachers insert own evidence" ON public.academy_evidence_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = academy_evidence_submissions.enrollment_id
        AND e.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Teachers update own pending or rejected evidence" ON public.academy_evidence_submissions;
CREATE POLICY "Teachers update own pending or rejected evidence" ON public.academy_evidence_submissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = academy_evidence_submissions.enrollment_id
        AND e.teacher_id = auth.uid()
    )
    AND status <> 'approved'
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.academy_enrollments e
      WHERE e.id = academy_evidence_submissions.enrollment_id
        AND e.teacher_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage evidence" ON public.academy_evidence_submissions;
CREATE POLICY "Admins manage evidence" ON public.academy_evidence_submissions
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP TRIGGER IF EXISTS trg_academy_evidence_updated_at ON public.academy_evidence_submissions;
CREATE TRIGGER trg_academy_evidence_updated_at
BEFORE UPDATE ON public.academy_evidence_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.tg_academy_issue_certificate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues boolean;
  v_requires_evidence boolean;
  v_number text;
BEGIN
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    SELECT issues_certificate, requires_evidence
      INTO v_issues, v_requires_evidence
      FROM public.academy_courses WHERE id = NEW.course_id;
    IF v_issues AND NOT COALESCE(v_requires_evidence, false) THEN
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

CREATE OR REPLACE FUNCTION public.tg_academy_evidence_issue_cert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_issues boolean;
  v_course_id uuid;
  v_number text;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT e.course_id INTO v_course_id
      FROM public.academy_enrollments e WHERE e.id = NEW.enrollment_id;
    SELECT issues_certificate INTO v_issues
      FROM public.academy_courses WHERE id = v_course_id;
    IF v_issues THEN
      IF NOT EXISTS (SELECT 1 FROM public.academy_certificates WHERE enrollment_id = NEW.enrollment_id) THEN
        v_number := 'Bezli-' || to_char(now(), 'YYYY') || '-' ||
                    lpad(nextval('public.academy_certificate_seq')::text, 6, '0');
        INSERT INTO public.academy_certificates (enrollment_id, certificate_number)
          VALUES (NEW.enrollment_id, v_number);
      END IF;
    END IF;
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  ELSIF NEW.status = 'rejected' AND (OLD.status IS DISTINCT FROM 'rejected') THEN
    NEW.reviewed_at := COALESCE(NEW.reviewed_at, now());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_academy_evidence_issue_cert ON public.academy_evidence_submissions;
CREATE TRIGGER trg_academy_evidence_issue_cert
BEFORE UPDATE ON public.academy_evidence_submissions
FOR EACH ROW EXECUTE FUNCTION public.tg_academy_evidence_issue_cert();

DROP POLICY IF EXISTS "Academy evidence: owner read" ON storage.objects;
CREATE POLICY "Academy evidence: owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'academy-evidence'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Academy evidence: authenticated upload own" ON storage.objects;
CREATE POLICY "Academy evidence: authenticated upload own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'academy-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Academy evidence: owner update" ON storage.objects;
CREATE POLICY "Academy evidence: owner update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'academy-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Academy evidence: owner delete" ON storage.objects;
CREATE POLICY "Academy evidence: owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'academy-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

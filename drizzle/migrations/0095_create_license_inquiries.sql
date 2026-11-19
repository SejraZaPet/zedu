CREATE TABLE IF NOT EXISTS public.license_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'form' CHECK (source IN ('demo','form','license','other')),
  name text CHECK (char_length(name) <= 200),
  email text CHECK (char_length(email) <= 255),
  phone text CHECK (char_length(phone) <= 50),
  organization text CHECK (char_length(organization) <= 300),
  role text CHECK (char_length(role) <= 100),
  plan text CHECK (char_length(plan) <= 100),
  student_count text CHECK (char_length(student_count) <= 20),
  message text CHECK (char_length(message) <= 5000),
  consent_accepted_at timestamptz,
  consent_terms_version text CHECK (char_length(consent_terms_version) <= 20),
  email_status text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed')),
  email_error text CHECK (char_length(email_error) <= 40),
  handled_status text NOT NULL DEFAULT 'new' CHECK (handled_status IN ('new','in_progress','done','spam')),
  handled_note text CHECK (char_length(handled_note) <= 2000),
  handled_at timestamptz,
  handled_by uuid
);

REVOKE ALL ON public.license_inquiries FROM PUBLIC, anon, authenticated;
GRANT SELECT, UPDATE ON public.license_inquiries TO authenticated;
GRANT ALL ON public.license_inquiries TO service_role;

ALTER TABLE public.license_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads inquiries" ON public.license_inquiries;
CREATE POLICY "Admin reads inquiries" ON public.license_inquiries
  FOR SELECT TO authenticated USING (public.is_admin());
DROP POLICY IF EXISTS "Admin updates inquiries" ON public.license_inquiries;
CREATE POLICY "Admin updates inquiries" ON public.license_inquiries
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.license_inquiries_guard_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF (NEW.source, NEW.name, NEW.email, NEW.phone, NEW.organization, NEW.role, NEW.plan,
        NEW.student_count, NEW.message, NEW.consent_accepted_at, NEW.consent_terms_version,
        NEW.email_status, NEW.email_error, NEW.created_at)
       IS DISTINCT FROM
       (OLD.source, OLD.name, OLD.email, OLD.phone, OLD.organization, OLD.role, OLD.plan,
        OLD.student_count, OLD.message, OLD.consent_accepted_at, OLD.consent_terms_version,
        OLD.email_status, OLD.email_error, OLD.created_at) THEN
      RAISE EXCEPTION 'Only handled_* fields can be changed' USING ERRCODE = '42501';
    END IF;
    NEW.handled_by := auth.uid();
    NEW.handled_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS license_inquiries_guard_update ON public.license_inquiries;
CREATE TRIGGER license_inquiries_guard_update BEFORE UPDATE ON public.license_inquiries
  FOR EACH ROW EXECUTE FUNCTION public.license_inquiries_guard_update();

CREATE INDEX IF NOT EXISTS license_inquiries_created_idx ON public.license_inquiries (created_at DESC);
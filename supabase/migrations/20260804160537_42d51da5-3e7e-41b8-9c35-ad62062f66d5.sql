ALTER TABLE public.school_licenses
  ADD COLUMN IF NOT EXISTS trial_duration_days integer NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS contract_years integer;

CREATE OR REPLACE FUNCTION public.school_license_autofill_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    IF NEW.status = 'trial' AND COALESCE(NEW.trial_duration_days, 0) > 0 THEN
      NEW.expires_at := COALESCE(NEW.starts_at, now()) + (NEW.trial_duration_days || ' days')::interval;
    ELSIF NEW.status = 'active' AND NEW.contract_years IS NOT NULL AND NEW.contract_years > 0 THEN
      NEW.expires_at := COALESCE(NEW.starts_at, now()) + (NEW.contract_years || ' years')::interval;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_license_autofill_expiry ON public.school_licenses;
CREATE TRIGGER trg_school_license_autofill_expiry
  BEFORE INSERT OR UPDATE ON public.school_licenses
  FOR EACH ROW EXECUTE FUNCTION public.school_license_autofill_expiry();

CREATE TABLE public.school_license_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.school_licenses(id) ON DELETE CASCADE,
  threshold_days integer NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (license_id, threshold_days)
);

GRANT SELECT ON public.school_license_reminders TO authenticated;
GRANT ALL ON public.school_license_reminders TO service_role;

ALTER TABLE public.school_license_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view license reminders"
  ON public.school_license_reminders FOR SELECT TO authenticated
  USING (public.is_admin());
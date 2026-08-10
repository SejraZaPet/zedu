ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS contact_category text NOT NULL DEFAULT 'jine';

ALTER TABLE public.crm_contacts
  DROP CONSTRAINT IF EXISTS crm_contacts_category_check;
ALTER TABLE public.crm_contacts
  ADD CONSTRAINT crm_contacts_category_check
  CHECK (contact_category IN ('vedeni','ucitel','jine'));

CREATE OR REPLACE FUNCTION public.tg_school_create_crm_organization()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_organizations WHERE linked_school_id = NEW.id) THEN
    INSERT INTO public.crm_organizations (name, type, status, linked_school_id, source)
    VALUES (NEW.name, 'skola', 'zakaznik', NEW.id, 'automaticky_pri_zalozeni');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schools_create_crm_organization ON public.schools;
CREATE TRIGGER schools_create_crm_organization
AFTER INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.tg_school_create_crm_organization();
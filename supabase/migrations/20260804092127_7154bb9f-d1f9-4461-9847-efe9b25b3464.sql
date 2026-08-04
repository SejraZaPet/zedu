-- ===== STAFF =====
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  position text,
  active boolean NOT NULL DEFAULT true,
  hired_at date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.staff_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id uuid NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  module text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (staff_member_id, module)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_permissions TO authenticated;
GRANT ALL ON public.staff_permissions TO service_role;

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff members" ON public.staff_members
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can view own record" ON public.staff_members
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

CREATE POLICY "Admins manage staff permissions" ON public.staff_permissions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Staff can view own permissions" ON public.staff_permissions
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.staff_members sm WHERE sm.id = staff_permissions.staff_member_id AND sm.profile_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.has_staff_permission(_module text, _user_id uuid, _need_edit boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'admin'
  ) OR EXISTS (
    SELECT 1
    FROM public.staff_members sm
    JOIN public.staff_permissions sp ON sp.staff_member_id = sm.id
    WHERE sm.profile_id = _user_id
      AND sm.active = true
      AND sp.module = _module
      AND (CASE WHEN _need_edit THEN sp.can_edit ELSE sp.can_view END)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.has_staff_permission(text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_staff_permission(text, uuid, boolean) TO authenticated, service_role;

-- ===== CRM =====
CREATE TABLE public.crm_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'skola',
  ico text,
  address text,
  website text,
  region text,
  source text,
  status text NOT NULL DEFAULT 'novy',
  notes text,
  linked_school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text,
  email text,
  phone text,
  is_primary boolean NOT NULL DEFAULT false,
  marketing_consent boolean NOT NULL DEFAULT false,
  unsubscribed_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#63C7CF',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.crm_organization_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.crm_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, tag_id)
);

CREATE TABLE public.crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.crm_organizations(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'jine',
  summary text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  next_step text,
  next_step_date date,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_contacts_org ON public.crm_contacts(organization_id);
CREATE INDEX idx_crm_interactions_org ON public.crm_interactions(organization_id, occurred_at DESC);
CREATE INDEX idx_crm_org_tags_org ON public.crm_organization_tags(organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_organizations TO authenticated;
GRANT ALL ON public.crm_organizations TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tags TO authenticated;
GRANT ALL ON public.crm_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_organization_tags TO authenticated;
GRANT ALL ON public.crm_organization_tags TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interactions TO authenticated;
GRANT ALL ON public.crm_interactions TO service_role;

ALTER TABLE public.crm_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_organization_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CRM view organizations" ON public.crm_organizations
  FOR SELECT TO authenticated USING (public.has_staff_permission('crm', auth.uid()));
CREATE POLICY "CRM edit organizations" ON public.crm_organizations
  FOR ALL TO authenticated
  USING (public.has_staff_permission('crm', auth.uid(), true))
  WITH CHECK (public.has_staff_permission('crm', auth.uid(), true));

CREATE POLICY "CRM view contacts" ON public.crm_contacts
  FOR SELECT TO authenticated USING (public.has_staff_permission('crm', auth.uid()));
CREATE POLICY "CRM edit contacts" ON public.crm_contacts
  FOR ALL TO authenticated
  USING (public.has_staff_permission('crm', auth.uid(), true))
  WITH CHECK (public.has_staff_permission('crm', auth.uid(), true));

CREATE POLICY "CRM view tags" ON public.crm_tags
  FOR SELECT TO authenticated USING (public.has_staff_permission('crm', auth.uid()));
CREATE POLICY "CRM edit tags" ON public.crm_tags
  FOR ALL TO authenticated
  USING (public.has_staff_permission('crm', auth.uid(), true))
  WITH CHECK (public.has_staff_permission('crm', auth.uid(), true));

CREATE POLICY "CRM view organization tags" ON public.crm_organization_tags
  FOR SELECT TO authenticated USING (public.has_staff_permission('crm', auth.uid()));
CREATE POLICY "CRM edit organization tags" ON public.crm_organization_tags
  FOR ALL TO authenticated
  USING (public.has_staff_permission('crm', auth.uid(), true))
  WITH CHECK (public.has_staff_permission('crm', auth.uid(), true));

CREATE POLICY "CRM view interactions" ON public.crm_interactions
  FOR SELECT TO authenticated USING (public.has_staff_permission('crm', auth.uid()));
CREATE POLICY "CRM edit interactions" ON public.crm_interactions
  FOR ALL TO authenticated
  USING (public.has_staff_permission('crm', auth.uid(), true))
  WITH CHECK (public.has_staff_permission('crm', auth.uid(), true));

CREATE TRIGGER update_crm_organizations_updated_at
  BEFORE UPDATE ON public.crm_organizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crm_tags (name, color) VALUES
  ('Vysoká priorita', '#E4572E'),
  ('Studená', '#7C93A6'),
  ('VIP', '#A065D7'),
  ('Alternativní škola', '#2FA36B'),
  ('Doporučeno', '#63C7CF');
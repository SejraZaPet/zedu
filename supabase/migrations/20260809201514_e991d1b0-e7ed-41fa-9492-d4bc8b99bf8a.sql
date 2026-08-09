ALTER TABLE public.staff_tasks
  ADD COLUMN IF NOT EXISTS related_organization_id uuid NULL REFERENCES public.crm_organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS staff_tasks_related_organization_id_idx ON public.staff_tasks(related_organization_id);
CREATE INDEX IF NOT EXISTS staff_tasks_related_user_id_idx ON public.staff_tasks(related_user_id);

ALTER TABLE public.crm_interactions
  ADD COLUMN IF NOT EXISTS related_user_id uuid NULL REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.crm_interactions ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.crm_interactions
  DROP CONSTRAINT IF EXISTS crm_interactions_target_present;
ALTER TABLE public.crm_interactions
  ADD CONSTRAINT crm_interactions_target_present
  CHECK (organization_id IS NOT NULL OR related_user_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS crm_interactions_related_user_id_idx ON public.crm_interactions(related_user_id);
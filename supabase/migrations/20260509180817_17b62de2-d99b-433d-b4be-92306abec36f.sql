-- Audit log table
CREATE TABLE public.audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON public.audit_log(action);
CREATE INDEX idx_audit_log_actor ON public.audit_log(actor_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins and school_admins can read
CREATE POLICY "Admins and school admins can view audit log"
ON public.audit_log
FOR SELECT
TO authenticated
USING (public.is_admin() OR public.is_school_admin(auth.uid()));

-- Authenticated users can insert their own audit entries (actor_id must be self or null for system)
CREATE POLICY "Users can insert audit entries as themselves"
ON public.audit_log
FOR INSERT
TO authenticated
WITH CHECK (actor_id = auth.uid() OR actor_id IS NULL);

CREATE TABLE public.school_join_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_name_text text NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE INDEX idx_school_join_requests_status ON public.school_join_requests (status);
CREATE INDEX idx_school_join_requests_user ON public.school_join_requests (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_join_requests TO authenticated;
GRANT ALL ON public.school_join_requests TO service_role;

ALTER TABLE public.school_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sjr_insert_own" ON public.school_join_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "sjr_select_own" ON public.school_join_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "sjr_admin_all" ON public.school_join_requests
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.tg_school_join_request_resolved()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'pending' THEN
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tg_school_join_request_resolved
BEFORE UPDATE ON public.school_join_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_school_join_request_resolved();
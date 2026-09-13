CREATE TABLE public.activity_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  template_props JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.activity_templates TO authenticated;
GRANT ALL ON public.activity_templates TO service_role;

ALTER TABLE public.activity_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own activity templates select"
  ON public.activity_templates FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users manage own activity templates insert"
  ON public.activity_templates FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own activity templates update"
  ON public.activity_templates FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users manage own activity templates delete"
  ON public.activity_templates FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX activity_templates_user_created_idx
  ON public.activity_templates (user_id, created_at DESC);
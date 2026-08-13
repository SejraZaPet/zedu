CREATE TABLE public.website_chat_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  feedback text CHECK (feedback IN ('up','down')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.website_chat_logs TO authenticated;
GRANT ALL ON public.website_chat_logs TO service_role;
ALTER TABLE public.website_chat_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view website chat logs" ON public.website_chat_logs
  FOR SELECT TO authenticated
  USING (public.has_staff_permission('website_assistant', auth.uid(), false));

CREATE TABLE public.website_assistant_faq (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.website_assistant_faq TO authenticated;
GRANT ALL ON public.website_assistant_faq TO service_role;
ALTER TABLE public.website_assistant_faq ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view faq" ON public.website_assistant_faq
  FOR SELECT TO authenticated
  USING (public.has_staff_permission('website_assistant', auth.uid(), false));
CREATE POLICY "Staff can insert faq" ON public.website_assistant_faq
  FOR INSERT TO authenticated
  WITH CHECK (public.has_staff_permission('website_assistant', auth.uid(), true));
CREATE POLICY "Staff can update faq" ON public.website_assistant_faq
  FOR UPDATE TO authenticated
  USING (public.has_staff_permission('website_assistant', auth.uid(), true))
  WITH CHECK (public.has_staff_permission('website_assistant', auth.uid(), true));
CREATE POLICY "Staff can delete faq" ON public.website_assistant_faq
  FOR DELETE TO authenticated
  USING (public.has_staff_permission('website_assistant', auth.uid(), true));

CREATE TRIGGER update_website_assistant_faq_updated_at
  BEFORE UPDATE ON public.website_assistant_faq
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_website_chat_logs_created_at ON public.website_chat_logs (created_at DESC);
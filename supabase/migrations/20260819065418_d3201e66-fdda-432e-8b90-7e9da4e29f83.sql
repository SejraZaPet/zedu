CREATE TABLE public.feedback_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  page_context text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.feedback_reports TO authenticated;
GRANT INSERT ON public.feedback_reports TO anon;
GRANT ALL ON public.feedback_reports TO service_role;

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
ON public.feedback_reports FOR INSERT TO anon, authenticated
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Admins can view feedback"
ON public.feedback_reports FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update feedback"
ON public.feedback_reports FOR UPDATE TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE INDEX idx_feedback_reports_created_at ON public.feedback_reports (created_at DESC);
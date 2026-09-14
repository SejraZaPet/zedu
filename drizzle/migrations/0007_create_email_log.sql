CREATE TABLE public.email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  provider_message_id TEXT,
  html TEXT,
  body_text TEXT,
  from_address TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT email_log_status_check CHECK (status IN ('pending','sent','failed'))
);

CREATE INDEX idx_email_log_created_at ON public.email_log (created_at DESC);
CREATE INDEX idx_email_log_status ON public.email_log (status);
CREATE INDEX idx_email_log_recipient ON public.email_log (lower(recipient));

GRANT SELECT ON public.email_log TO authenticated;
GRANT ALL ON public.email_log TO service_role;

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email log"
ON public.email_log
FOR SELECT
TO authenticated
USING (public.is_admin());
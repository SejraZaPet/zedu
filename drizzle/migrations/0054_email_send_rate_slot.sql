CREATE TABLE public.email_send_rate (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_slot timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.email_send_rate TO service_role;
ALTER TABLE public.email_send_rate ENABLE ROW LEVEL SECURITY;
INSERT INTO public.email_send_rate (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.reserve_email_send_slot(_interval_ms integer DEFAULT 500)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _slot timestamptz;
BEGIN
  UPDATE public.email_send_rate
     SET next_slot = greatest(now(), next_slot) + make_interval(secs => _interval_ms / 1000.0)
   WHERE id = 1
  RETURNING next_slot - make_interval(secs => _interval_ms / 1000.0) INTO _slot;
  RETURN greatest(0, ceil(extract(epoch FROM (_slot - now())) * 1000))::integer;
END $$;
REVOKE ALL ON FUNCTION public.reserve_email_send_slot(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_email_send_slot(integer) TO service_role;
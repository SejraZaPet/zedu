CREATE TABLE public.demo_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  return_code text NOT NULL UNIQUE,
  event_tag text CHECK (event_tag IS NULL OR char_length(event_tag) <= 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_active_at timestamptz NOT NULL DEFAULT now(),
  ip_hash text NOT NULL
);
CREATE INDEX demo_pairs_return_code_idx ON public.demo_pairs (return_code);
CREATE INDEX demo_pairs_teacher_idx ON public.demo_pairs (teacher_user_id);
CREATE INDEX demo_pairs_student_idx ON public.demo_pairs (student_user_id);
GRANT ALL ON public.demo_pairs TO service_role;
ALTER TABLE public.demo_pairs ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.demo_rate_events (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,
  ip_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX demo_rate_events_lookup_idx ON public.demo_rate_events (kind, ip_hash, created_at);
CREATE INDEX demo_rate_events_kind_time_idx ON public.demo_rate_events (kind, created_at);
GRANT ALL ON public.demo_rate_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.demo_rate_events_id_seq TO service_role;
ALTER TABLE public.demo_rate_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_demo_pair()
RETURNS TABLE (return_code text, event_tag text, my_side text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.return_code, d.event_tag,
         CASE WHEN d.teacher_user_id = auth.uid() THEN 'teacher' ELSE 'student' END
  FROM public.demo_pairs d
  WHERE auth.uid() IS NOT NULL
    AND (d.teacher_user_id = auth.uid() OR d.student_user_id = auth.uid())
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_my_demo_pair() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_demo_pair() TO authenticated;
NOTIFY pgrst, 'reload schema';